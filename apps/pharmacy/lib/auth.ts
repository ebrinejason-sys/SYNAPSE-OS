import { getContext, type SynapseContext } from '@synapse/auth/context'

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
}

export async function getPharmacySession(): Promise<PharmacySession | null> {
  try {
    const ctx: SynapseContext = await getContext('pharmacy', '__never__')
    return {
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
      tenantId: ctx.user.tenantId,
      fullName: ctx.user.fullName,
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      isAdmin: ctx.user.isAdmin,
      tenantName: ctx.tenant.name,
      tenantSlug: ctx.tenant.slug,
      tenantStatus: ctx.tenant.status,
      modulesEnabled: ctx.tenant.modulesEnabled,
      mustChangePassword: ctx.user.mustChangePassword,
    }
  } catch {
    return null
  }
}

export async function requirePharmacySession(): Promise<PharmacySession> {
  const ctx: SynapseContext = await getContext('pharmacy', '/login')
  return {
    userId: ctx.user.id,
    email: ctx.user.email,
    role: ctx.user.role,
    tenantId: ctx.user.tenantId,
    fullName: ctx.user.fullName,
    firstName: ctx.user.firstName,
    lastName: ctx.user.lastName,
    isAdmin: ctx.user.isAdmin,
    tenantName: ctx.tenant.name,
    tenantSlug: ctx.tenant.slug,
    tenantStatus: ctx.tenant.status,
    modulesEnabled: ctx.tenant.modulesEnabled,
    mustChangePassword: ctx.user.mustChangePassword,
  }
}

export function hasPharmacyPermission(session: PharmacySession, permission: string): boolean {
  if (session.isAdmin) return true
  if (session.role === 'pharmacy_admin') return true
  return false
}

export const isPharmacyAdmin = (session: PharmacySession): boolean =>
  session.isAdmin || session.role === 'pharmacy_admin'

export const hasPermission = (session: PharmacySession, _permission: string): boolean =>
  isPharmacyAdmin(session)
