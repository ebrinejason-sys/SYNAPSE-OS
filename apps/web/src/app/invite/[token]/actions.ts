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

  if (!token)                     return { error: 'Missing invite token.' }
  if (password.length < 8)        return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm)        return { error: 'Passwords do not match.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  // Re-validate token (guards against replay after expiry)
  const { data: onboarding } = await db
    .from('pharmacy_onboarding')
    .select('tenant_id, invite_token, invite_expires_at, account_created_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!onboarding)                           return { error: 'Invalid invite token.' }
  if (onboarding.account_created_at)         return { error: 'This account has already been set up.' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { error: 'This invite has expired. Ask your administrator to resend it.' }

  const tenantId = onboarding.tenant_id as string

  // Get the pharmacy admin profile for this tenant
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, synapse_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'pharmacy_admin')
    .maybeSingle()

  if (!profile) return { error: 'No admin profile found for this pharmacy.' }

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

  redirect('/pharmacy')
}
