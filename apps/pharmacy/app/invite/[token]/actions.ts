'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { signToken, createSession, hashPassword } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export type InviteDetails =
  | { status: 'valid'; pharmacyName: string; adminEmail: string; adminName: string; profileExists: boolean }
  | { status: 'invalid' | 'already_used' }

export async function getInviteDetails(token: string): Promise<InviteDetails> {
  const { data: onboarding } = await supabaseAdmin
    .from('pharmacy_onboarding')
    .select('tenant_id, current_step, invite_expires_at, admin_email, admin_name')
    .eq('invite_token', token)
    .maybeSingle()

  if (!onboarding) {
    console.error(
      '[invite] getInviteDetails: no row for token.',
      'SUPABASE_URL:', process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET'
    )
    return { status: 'invalid' }
  }

  if (onboarding.current_step >= 1) return { status: 'already_used' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { status: 'invalid' }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', onboarding.tenant_id)
    .eq('facility_type', 'pharmacy')
    .maybeSingle()

  if (!tenant) return { status: 'invalid' }

  // Check if the admin profile already exists for this tenant
  const { data: settings } = await supabaseAdmin
    .from('pharmacy_user_settings')
    .select('profile_id')
    .eq('tenant_id', onboarding.tenant_id)
    .eq('pharmacy_role', 'pharmacy_admin')
    .maybeSingle()

  let adminEmail = (onboarding.admin_email as string | null) ?? ''
  let adminName  = (onboarding.admin_name  as string | null) ?? ''
  const profileExists = !!settings?.profile_id

  if (profileExists && settings?.profile_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', settings.profile_id)
      .maybeSingle()
    if (profile) {
      adminEmail = (profile.email as string) || adminEmail
      adminName  = (profile.full_name as string) || adminName
    }
  }

  return {
    status: 'valid',
    pharmacyName: tenant.name ?? 'Your pharmacy',
    adminEmail,
    adminName,
    profileExists,
  }
}

export async function setupAccount(
  token: string,
  fullName: string,
  password: string,
  emailInput?: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  // 1. Validate token
  const { data: onboarding } = await supabaseAdmin
    .from('pharmacy_onboarding')
    .select('id, tenant_id, current_step, invite_expires_at, admin_email, admin_name')
    .eq('invite_token', token)
    .maybeSingle()

  if (!onboarding) return { success: false, error: 'Invalid invite token' }
  if (onboarding.current_step >= 1) return { success: false, error: 'already_used' }
  if (new Date(onboarding.invite_expires_at) < new Date()) return { success: false, error: 'Token has expired' }

  const tenantId = onboarding.tenant_id as string
  const passwordHash = await hashPassword(password)
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName  = nameParts.slice(1).join(' ') || ''

  // 2. Try to find existing pharmacy admin settings
  const { data: adminSettings } = await supabaseAdmin
    .from('pharmacy_user_settings')
    .select('profile_id')
    .eq('tenant_id', tenantId)
    .eq('pharmacy_role', 'pharmacy_admin')
    .maybeSingle()

  let adminEmail: string

  if (adminSettings?.profile_id) {
    // ── Normal path: profile exists, update it ────────────────────
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', adminSettings.profile_id)
      .maybeSingle()

    if (!profileRow?.email) return { success: false, error: 'Admin user not found' }
    adminEmail = profileRow.email as string

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name:           fullName.trim(),
        first_name:          firstName,
        last_name:           lastName,
        role:                'pharmacy_admin',
        password_hash:       passwordHash,
        email_verified_at:   new Date().toISOString(),
        verification_status: 'verified',
      })
      .eq('id', adminSettings.profile_id)

    if (updateError) return { success: false, error: updateError.message }

  } else {
    // ── Self-heal: profile was never created, create it now ───────
    const resolvedEmail = (emailInput?.trim().toLowerCase()) ||
                          (onboarding.admin_email as string | null) || ''

    if (!resolvedEmail) {
      return { success: false, error: 'Could not determine account email. Please enter your email address.' }
    }

    // Guard: email must not already be in use
    const { data: taken } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', resolvedEmail)
      .maybeSingle()

    if (taken) {
      return { success: false, error: `An account with email "${resolvedEmail}" already exists.` }
    }

    const { data: created, error: createErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        email:               resolvedEmail,
        full_name:           fullName.trim(),
        first_name:          firstName,
        last_name:           lastName,
        role:                'pharmacy_admin',
        tenant_id:           tenantId,
        is_admin:            true,
        password_hash:       passwordHash,
        email_verified_at:   new Date().toISOString(),
        verification_status: 'verified',
      })
      .select('id')
      .single()

    if (createErr || !created) {
      return { success: false, error: `Failed to create profile: ${createErr?.message ?? 'unknown error'}` }
    }

    await supabaseAdmin.from('pharmacy_user_settings').insert({
      profile_id:    created.id,
      tenant_id:     tenantId,
      pharmacy_role: 'pharmacy_admin',
    }).throwOnError()

    adminEmail = resolvedEmail

    // Backfill onboarding with email/name for future reference
    await supabaseAdmin
      .from('pharmacy_onboarding')
      .update({ admin_email: resolvedEmail, admin_name: fullName.trim() })
      .eq('id', onboarding.id)
  }

  // 3. Platform already collected pharmacy identity at provision time.
  // Mark the optional license wizard complete so first login lands in the portal.
  await supabaseAdmin
    .from('pharmacy_onboarding')
    .update({
      current_step: 5,
      account_created_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', onboarding.id)

  await supabaseAdmin
    .from('tenants')
    .update({ onboarding_completed: true, onboarding_step: 5 })
    .eq('id', tenantId)

  await supabaseAdmin
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('email', adminEmail)
    .eq('tenant_id', tenantId)

  // 4. Issue session
  try {
    const { data: profileForSession } = await supabaseAdmin
      .from('profiles')
      .select('id, synapse_id')
      .eq('email', adminEmail)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (profileForSession) {
      const sessionToken = await signToken({
        sub:        profileForSession.id as string,
        email:      adminEmail,
        role:       'pharmacy_admin',
        tenant_id:  tenantId,
        app:        'pharmacy',
        synapse_id: (profileForSession.synapse_id as string | null) ?? undefined,
      })

      await createSession({
        userId: profileForSession.id as string,
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
    }
  } catch (sessionErr) {
    console.error('Session creation failed after invite (non-fatal):', sessionErr)
  }

  return { success: true, email: adminEmail }
}
