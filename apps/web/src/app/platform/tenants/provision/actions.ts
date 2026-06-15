'use server'

import { supabaseAdmin } from '@synapse/db/admin'
import { hashPassword } from '@synapse/auth'
import { requirePlatformAdmin } from '../../../../lib/platform/auth'
import { Resend } from 'resend'

export interface ProvisionInput {
  facilityType:  string
  name:          string
  slug:          string
  country:       string
  district:      string
  address:       string
  phone:         string
  email:         string
  planSlug:      string
  adminEmail:    string
  adminPassword: string
  adminFullName: string
}

export interface ProvisionResult {
  ok:        boolean
  tenantId?: string
  error?:    string
}

export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  await requirePlatformAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  // Validate slug uniqueness
  const { data: existing } = await db
    .from('tenants')
    .select('id')
    .eq('slug', input.slug.toLowerCase().trim())
    .maybeSingle()

  if (existing) return { ok: false, error: `Subdomain "${input.slug}" is already taken.` }

  // Validate plan exists
  const { data: plan } = await db
    .from('subscription_plans')
    .select('id')
    .eq('slug', input.planSlug)
    .maybeSingle()

  if (!plan) return { ok: false, error: 'Invalid subscription plan selected.' }

  // 1. Create tenant
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({
      slug:          input.slug.toLowerCase().trim(),
      name:          input.name.trim(),
      facility_type: input.facilityType,
      country:       input.country,
      district:      input.district,
      address:       input.address,
      phone:         input.phone,
      email:         input.email,
      is_active:     true,
      onboarding_completed: false,
      onboarding_step:      1,
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    return { ok: false, error: tenantErr?.message ?? 'Failed to create tenant.' }
  }

  // 2. Create tenant subscription
  const { error: subErr } = await db
    .from('tenant_subscriptions')
    .insert({ tenant_id: tenant.id, plan_id: plan.id, status: 'active' })

  if (subErr) {
    await db.from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: `Subscription error: ${subErr.message}` }
  }

  // 3. Hash password
  let passwordHash: string
  try {
    passwordHash = await hashPassword(input.adminPassword)
  } catch {
    await db.from('tenant_subscriptions').delete().eq('tenant_id', tenant.id)
    await db.from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: 'Failed to hash admin password.' }
  }

  // 4. Create admin profile
  const { error: profileErr } = await db
    .from('profiles')
    .insert({
      tenant_id:     tenant.id,
      email:         input.adminEmail.trim().toLowerCase(),
      full_name:     input.adminFullName.trim(),
      role:          'hospital_admin',
      password_hash: passwordHash,
      is_admin:      true,
    })

  if (profileErr) {
    await db.from('tenant_subscriptions').delete().eq('tenant_id', tenant.id)
    await db.from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: `Admin user error: ${profileErr.message}` }
  }

  // 5. Audit log
  await db.from('audit_log').insert({
    tenant_id:  tenant.id,
    action:     'INSERT',
    table_name: 'tenants',
    record_id:  tenant.id,
    new_value:  { name: input.name, facility_type: input.facilityType, plan: input.planSlug },
  }).catch(() => {})

  return { ok: true, tenantId: tenant.id }
}

export interface PharmacyProvisionInput {
  name:          string
  slug:          string
  district:      string
  adminEmail:    string
  adminFullName: string
}

export interface PharmacyProvisionResult {
  ok:         boolean
  tenantId?:  string
  inviteUrl?: string
  error?:     string
}

export async function provisionPharmacy(input: PharmacyProvisionInput): Promise<PharmacyProvisionResult> {
  await requirePlatformAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

  const { data: existing } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existing) return { ok: false, error: `Subdomain "${slug}" is already taken.` }

  const { data: existingProfile } = await db.from('profiles').select('id').eq('email', input.adminEmail.trim().toLowerCase()).maybeSingle()
  if (existingProfile) return { ok: false, error: `An account with email "${input.adminEmail}" already exists.` }

  // 1. Create tenant
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({
      slug,
      name:          input.name.trim(),
      facility_type: 'pharmacy',
      country:       'Uganda',
      district:      input.district.trim() || null,
      status:        'pending',
      is_active:     false,
      onboarding_completed: false,
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) return { ok: false, error: tenantErr?.message ?? 'Failed to create pharmacy.' }

  // 2. Create profile
  const nameParts = input.adminFullName.trim().split(' ')
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .insert({
      email:      input.adminEmail.trim().toLowerCase(),
      full_name:  input.adminFullName.trim(),
      first_name: nameParts[0] ?? '',
      last_name:  nameParts.slice(1).join(' ') || null,
      role:       'pharmacy_admin',
      tenant_id:  tenant.id,
      is_admin:   true,
    })
    .select('id')
    .single()

  if (profileErr || !profile) {
    await db.from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: profileErr?.message ?? 'Failed to create admin profile.' }
  }

  // 3. Create pharmacy_user_settings
  await db.from('pharmacy_user_settings').insert({
    profile_id:    profile.id,
    tenant_id:     tenant.id,
    pharmacy_role: 'pharmacy_admin',
    is_admin:      true,
  }).catch(() => {})

  // 4. Generate invite token and onboarding row
  const inviteToken = crypto.randomUUID()
  const inviteExpiry = new Date()
  inviteExpiry.setHours(inviteExpiry.getHours() + 72)

  const { error: onboardErr } = await db.from('pharmacy_onboarding').insert({
    tenant_id:         tenant.id,
    current_step:      0,
    invite_token:      inviteToken,
    invite_expires_at: inviteExpiry.toISOString(),
    admin_email:       input.adminEmail.trim().toLowerCase(),
    admin_name:        input.adminFullName.trim(),
  })

  if (onboardErr) {
    await db.from('profiles').delete().eq('id', profile.id)
    await db.from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: `Onboarding setup error: ${onboardErr.message}` }
  }

  // 5. Send invite email
  const baseUrl = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? 'https://pharm.synapseos.tech'
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`
  const firstName = nameParts[0] ?? 'there'

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'Synapse OS <noreply@synapseos.tech>',
      to:      input.adminEmail.trim().toLowerCase(),
      subject: `You're invited to set up ${input.name.trim()} on Synapse`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#F97316,#E8B84B);display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:900;font-size:18px;">S</span>
          </div>
          <strong style="font-size:16px;">Synapse Pharmacy</strong>
        </div>
        <h2 style="margin:0 0 8px;">Welcome, ${firstName}!</h2>
        <p style="color:#555;margin:0 0 16px;">Your pharmacy <strong>${input.name.trim()}</strong> has been registered on Synapse OS. Click below to set up your account.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Set Up My Account →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">This link expires in 72 hours.<br/>${inviteUrl}</p>
      </div>`,
    })
  } catch (emailErr) {
    console.error('Invite email failed (non-fatal):', emailErr)
  }

  // 6. Audit log
  await db.from('audit_log').insert({
    tenant_id:  tenant.id,
    action:     'INSERT',
    table_name: 'tenants',
    record_id:  tenant.id,
    new_value:  { name: input.name, facility_type: 'pharmacy', admin: input.adminEmail },
  }).catch(() => {})

  return { ok: true, tenantId: tenant.id, inviteUrl }
}
