'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { signToken, createSession, hashPassword } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function getInviteDetails(
  token: string
): Promise<{ status: 'valid'; pharmacyName: string } | { status: 'invalid' | 'already_used' }> {
  const { data: onboarding } = await supabaseAdmin
    .from('pharmacy_onboarding')
    .select('tenant_id, current_step, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (!onboarding) return { status: 'invalid' }
  if (onboarding.current_step >= 1) return { status: 'already_used' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { status: 'invalid' }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', onboarding.tenant_id)
    .eq('facility_type', 'pharmacy')
    .single()

  if (!tenant) return { status: 'invalid' }

  return { status: 'valid', pharmacyName: tenant.name ?? 'Your pharmacy' }
}

export async function setupAccount(
  token: string,
  fullName: string,
  password: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  // 1. Fetch onboarding record by token
  const { data: onboarding } = await supabaseAdmin
    .from('pharmacy_onboarding')
    .select('id, tenant_id, current_step, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (!onboarding) return { success: false, error: 'Invalid invite token' }
  if (onboarding.current_step >= 1) return { success: false, error: 'already_used' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { success: false, error: 'Token has expired' }

  // 2. Find the pharmacy admin via pharmacy_user_settings
  const { data: adminSettings } = await supabaseAdmin
    .from('pharmacy_user_settings')
    .select('profile_id')
    .eq('tenant_id', onboarding.tenant_id)
    .eq('pharmacy_role', 'pharmacy_admin')
    .single()

  if (!adminSettings) return { success: false, error: 'Admin account not found' }

  // 3. Get admin email from profiles table (custom auth — no Supabase Auth users)
  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', adminSettings.profile_id)
    .single()

  if (!profileRow?.email) return { success: false, error: 'Admin user not found' }
  const adminEmail = profileRow.email as string

  // 4. Hash password using custom auth and update the profile directly
  const passwordHash = await hashPassword(password)
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || ''

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      tenant_id: onboarding.tenant_id,
      role: 'pharmacy_admin',
      password_hash: passwordHash,
      email_verified_at: new Date().toISOString(),
      verification_status: 'verified',
    })
    .eq('id', adminSettings.profile_id)

  if (updateError) return { success: false, error: updateError.message }

  // 5. Update onboarding step
  await supabaseAdmin
    .from('pharmacy_onboarding')
    .update({
      current_step: 1,
      account_created_at: new Date().toISOString(),
    })
    .eq('id', onboarding.id)

  // 6. Activate the tenant
  await supabaseAdmin
    .from('tenants')
    .update({
      status: 'active',
      is_active: true,
    })
    .eq('id', onboarding.tenant_id)

  // 7. Issue session so the browser is authenticated immediately
  try {
    const sessionToken = await signToken({
      sub:       adminSettings.profile_id as string,
      email:     adminEmail,
      role:      'pharmacy_admin',
      tenant_id: onboarding.tenant_id as string,
      app:       'pharmacy',
    })

    await createSession({
      userId: adminSettings.profile_id as string,
      token:  sessionToken,
      app:    'pharmacy',
    })

    const cookieStore = await cookies()
    const expires = new Date()
    expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires,
      path:     '/',
    })
  } catch (sessionErr) {
    console.error('synapse_session creation failed after invite (non-fatal):', sessionErr)
  }

  return { success: true, email: adminEmail }
}
