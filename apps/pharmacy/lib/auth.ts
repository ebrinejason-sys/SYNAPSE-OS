import { createClient } from '@/lib/supabase/server'

export interface PharmacySession {
  user: { id: string; email: string | undefined }
  profile: {
    tenant_id: string | null
    is_admin: boolean
    full_name: string | null
    first_name: string | null
    last_name: string | null
  }
  userSettings: {
    pharmacy_role: string
    permissions: string[]
    must_change_password: boolean
    is_active: boolean
  } | null
}

export async function getPharmacySession(): Promise<PharmacySession | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, is_admin, full_name, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const { data: userSettings } = await supabase
    .from('pharmacy_user_settings')
    .select('pharmacy_role, permissions, must_change_password, is_active')
    .eq('profile_id', user.id)
    .single()

  return {
    user: { id: user.id, email: user.email },
    profile: {
      tenant_id: profile.tenant_id ?? null,
      is_admin: profile.is_admin ?? false,
      full_name: profile.full_name ?? null,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
    },
    userSettings: userSettings ?? null,
  }
}

export function hasPermission(
  session: PharmacySession,
  permission: string
): boolean {
  const role = session.userSettings?.pharmacy_role
  if (role === 'pharmacy_ceo' || role === 'pharmacy_admin') return true
  if (!permission) return true
  return session.userSettings?.permissions?.includes(permission) ?? false
}

export function isPharmacyAdmin(session: PharmacySession): boolean {
  const role = session.userSettings?.pharmacy_role
  return role === 'pharmacy_ceo' || role === 'pharmacy_admin' || session.profile.is_admin
}
