'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'

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

  // 2. Find the pharmacy admin via pharmacy_user_settings (reliable — enrollment always creates this)
  const { data: adminSettings } = await supabaseAdmin
    .from('pharmacy_user_settings')
    .select('profile_id')
    .eq('tenant_id', onboarding.tenant_id)
    .eq('pharmacy_role', 'pharmacy_admin')
    .single()

  if (!adminSettings) return { success: false, error: 'Admin account not found' }

  // 3. Get admin email from Supabase Auth
  const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(adminSettings.profile_id)
  if (!authUserData?.user) return { success: false, error: 'Admin user not found' }
  const adminEmail = authUserData.user.email

  // 4. Update auth user password and metadata
  const nameParts = fullName.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || ''

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(adminSettings.profile_id, {
    password,
    user_metadata: { full_name: fullName },
  })
  if (updateError) return { success: false, error: updateError.message }

  // 5. Update profile — set tenant_id (critical for RLS) + name
  await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      tenant_id: onboarding.tenant_id,
      role: 'pharmacy_admin',
    })
    .eq('id', adminSettings.profile_id)

  // 6. Update onboarding step
  await supabaseAdmin
    .from('pharmacy_onboarding')
    .update({
      current_step: 1,
      account_created_at: new Date().toISOString(),
    })
    .eq('id', onboarding.id)

  // 7. Activate the tenant
  await supabaseAdmin
    .from('tenants')
    .update({
      status: 'active',
      is_active: true,
    })
    .eq('id', onboarding.tenant_id)

  return { success: true, email: adminEmail }
}
