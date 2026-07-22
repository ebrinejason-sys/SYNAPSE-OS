import { getContext, type SynapseContext } from '@synapse/auth/context'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export type PlatformAdminProfile = {
  id: string
  role: string
  fullName: string | null
  avatarUrl: string | null
  email: string
}

/** Canonical platform-admin gate — role OR ADMIN_EMAILS allow-list. */
export function hasPlatformAdminAccess(role: string | null | undefined, email: string | null | undefined): boolean {
  if (role === 'platform_admin') return true
  if (email && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}

export async function requirePlatformAdmin(): Promise<PlatformAdminProfile> {
  const ctx: SynapseContext = await getContext('web', '/platform/login')

  if (!hasPlatformAdminAccess(ctx.user.role, ctx.user.email)) {
    const { redirect } = await import('next/navigation')
    redirect('/platform/login')
  }

  return {
    id: ctx.user.id,
    role: ctx.user.role,
    fullName: ctx.user.fullName,
    avatarUrl: ctx.user.avatarUrl,
    email: ctx.user.email,
  }
}
