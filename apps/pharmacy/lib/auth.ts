import { getContext, getContextSafe, type SynapseContext } from '@synapse/auth/context'
import { supabaseAdmin } from '@synapse/db/admin'
import { sessionHasCapability } from '@/lib/capabilities'

export type PharmacySession = {
  userId: string
  email: string
  role: string
  tenantId: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  isAdmin: boolean
  tenantName: string
  tenantSlug: string
  tenantStatus: string
  modulesEnabled: string[]
  mustChangePassword: boolean
  permissions: string[]
  pharmacyRole: string
  isImpersonation: boolean
  impersonatorId: string | null
  profile: { tenant_id: string; is_admin: boolean; full_name: string | null; first_name: string | null; last_name: string | null }
  user: { id: string; email: string }
}

async function loadPharmacySettings(userId: string): Promise<{
  pharmacyRole: string | null
  permissions: string[]
  mustChangePassword: boolean | null
}> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('pharmacy_user_settings')
      .select('pharmacy_role, permissions, must_change_password')
      .eq('profile_id', userId)
      .maybeSingle()

    return {
      pharmacyRole: (data?.pharmacy_role as string | null) ?? null,
      permissions: Array.isArray(data?.permissions) ? (data.permissions as string[]) : [],
      mustChangePassword: (data?.must_change_password as boolean | null) ?? null,
    }
  } catch {
    return { pharmacyRole: null, permissions: [], mustChangePassword: null }
  }
}

async function toPharmacySession(ctx: SynapseContext): Promise<PharmacySession> {
  const settings = await loadPharmacySettings(ctx.user.id)
  const pharmacyRole = settings.pharmacyRole ?? ctx.user.role
  const isAdmin =
    ctx.user.isAdmin ||
    pharmacyRole === 'pharmacy_admin' ||
    pharmacyRole === 'pharmacy_ceo' ||
    ctx.user.role === 'pharmacy_admin'

  return {
    userId: ctx.user.id,
    email: ctx.user.email,
    role: pharmacyRole,
    tenantId: ctx.user.tenantId,
    fullName: ctx.user.fullName,
    firstName: ctx.user.firstName,
    lastName: ctx.user.lastName,
    isAdmin,
    tenantName: ctx.tenant.name,
    tenantSlug: ctx.tenant.slug,
    tenantStatus: ctx.tenant.status,
    modulesEnabled: ctx.tenant.modulesEnabled,
    mustChangePassword: settings.mustChangePassword ?? ctx.user.mustChangePassword,
    permissions: settings.permissions,
    pharmacyRole,
    isImpersonation: ctx.isImpersonation,
    impersonatorId: ctx.impersonatorId,
    profile: {
      tenant_id: ctx.user.tenantId,
      is_admin: isAdmin,
      full_name: ctx.user.fullName,
      first_name: ctx.user.firstName,
      last_name: ctx.user.lastName,
    },
    user: { id: ctx.user.id, email: ctx.user.email },
  }
}

export async function getPharmacySession(): Promise<PharmacySession | null> {
  const ctx = await getContextSafe('pharmacy')
  return ctx ? toPharmacySession(ctx) : null
}

export async function requirePharmacySession(): Promise<PharmacySession> {
  const ctx: SynapseContext = await getContext('pharmacy', '/login')
  return toPharmacySession(ctx)
}

export function hasPharmacyPermission(session: PharmacySession, permission: string): boolean {
  return sessionHasCapability(session, permission)
}

export const isPharmacyAdmin = (session: PharmacySession): boolean =>
  session.isAdmin ||
  session.pharmacyRole === 'pharmacy_admin' ||
  session.pharmacyRole === 'pharmacy_ceo'

export const hasPermission = (session: PharmacySession, permission: string): boolean =>
  hasPharmacyPermission(session, permission)
