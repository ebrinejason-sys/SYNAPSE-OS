'use server'

import { supabaseAdmin } from '@synapse/db/admin'
import { hashPassword } from '@synapse/auth'
import { requirePlatformAdmin } from '../../../../lib/platform/auth'

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
