import { getContext, type SynapseContext } from '@synapse/auth/context'

export type PlatformAdminProfile = {
  id: string
  role: string
  fullName: string | null
  avatarUrl: string | null
  email: string
}

export async function requirePlatformAdmin(): Promise<PlatformAdminProfile> {
  const ctx: SynapseContext = await getContext('web', '/platform/login')

  if (ctx.user.role !== 'platform_admin') {
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
