'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hashPassword, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function redeemInvite(
  formData: FormData
): Promise<{ error: string } | never> {
  const token       = String(formData.get('token') ?? '').trim()
  const password    = String(formData.get('password') ?? '')
  const confirm     = String(formData.get('confirmPassword') ?? '')
  // Only present when the profile didn't exist at provisioning time
  const formName    = String(formData.get('adminName')  ?? '').trim()
  const formEmail   = String(formData.get('adminEmail') ?? '').trim().toLowerCase()

  if (!token)              return { error: 'Missing invite token.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  // Re-validate token (guards against replay after expiry)
  const { data: onboarding } = await db
    .from('pharmacy_onboarding')
    .select('tenant_id, invite_token, invite_expires_at, account_created_at, admin_email, admin_name')
    .eq('invite_token', token)
    .maybeSingle()

  if (!onboarding)                           return { error: 'Invalid invite token.' }
  if (onboarding.account_created_at)         return { error: 'This account has already been set up.' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { error: 'This invite has expired. Ask your administrator to resend it.' }

  const tenantId = onboarding.tenant_id as string

  // Try to find the existing admin profile for this tenant
  let { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, synapse_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'pharmacy_admin')
    .maybeSingle()

  // ── Self-heal: profile was never created (provisioning failed mid-way) ──
  if (!profile) {
    // Resolve which email/name to use: form input > onboarding stored > error
    const resolvedEmail = formEmail || (onboarding.admin_email as string | null) || ''
    const resolvedName  = formName  || (onboarding.admin_name  as string | null) || ''

    if (!resolvedEmail) return { error: 'Could not determine account email. Please enter your email address.' }
    if (!resolvedName)  return { error: 'Please enter your full name.' }

    // Check the email isn't already taken by another profile
    const { data: taken } = await db
      .from('profiles')
      .select('id')
      .eq('email', resolvedEmail)
      .maybeSingle()

    if (taken) return { error: `An account with email "${resolvedEmail}" already exists. Contact support if this is your address.` }

    const nameParts = resolvedName.split(' ')
    const { data: created, error: createErr } = await db
      .from('profiles')
      .insert({
        email:      resolvedEmail,
        full_name:  resolvedName,
        first_name: nameParts[0] ?? '',
        last_name:  nameParts.slice(1).join(' ') || null,
        role:       'pharmacy_admin',
        tenant_id:  tenantId,
        is_admin:   true,
      })
      .select('id, email, role, full_name, synapse_id')
      .single()

    if (createErr || !created) {
      return { error: `Failed to create your account profile: ${createErr?.message ?? 'unknown error'}` }
    }

    // Also create pharmacy_user_settings if missing
    await db.from('pharmacy_user_settings').insert({
      profile_id:    created.id,
      tenant_id:     tenantId,
      pharmacy_role: 'pharmacy_admin',
      is_admin:      true,
    }).catch(() => {})

    profile = created
  }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  // 1. Activate the profile: set password + mark email verified
  const { error: profileErr } = await db
    .from('profiles')
    .update({
      password_hash:     passwordHash,
      email_verified_at: now,
      login_attempts:    0,
      locked_until:      null,
      updated_at:        now,
    })
    .eq('id', profile.id as string)

  if (profileErr) return { error: 'Failed to save account credentials. Please try again.' }

  // 2. Advance onboarding step + record account creation
  await db
    .from('pharmacy_onboarding')
    .update({ current_step: 1, account_created_at: now, updated_at: now })
    .eq('tenant_id', tenantId)

  // 3. Activate the tenant
  await db
    .from('tenants')
    .update({ status: 'active', is_active: true, updated_at: now })
    .eq('id', tenantId)

  // 4. Mint JWT + create session
  const jwtToken = await signToken({
    sub:       profile.id as string,
    email:     profile.email as string,
    role:      profile.role as string,
    tenant_id: tenantId,
    app:       'web',
    synapse_id: (profile.synapse_id as string | null) ?? undefined,
  })

  await createSession({
    userId: profile.id as string,
    token:  jwtToken,
    app:    'web',
  })

  // 5. Set session cookie
  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path:     '/',
  })

  const pharmacyApp = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? 'https://pharm.synapseos.tech'
  redirect(pharmacyApp)
}
