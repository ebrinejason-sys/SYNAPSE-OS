// packages/auth/src/context.server.ts
// NEXT.JS ONLY — server components and server actions

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, type SynapseTokenPayload } from './tokens'
import { validateSession } from './sessions'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'
import type { AppSurface, SynapseRole } from '@synapse/config/constants'
import { isAccountActivated } from './activation'
import { assertSessionMatchesHost } from './tenant-guard.server'

export interface SynapseContext {
  user: {
    id: string
    email: string
    role: SynapseRole
    fullName: string | null
    firstName: string | null
    lastName: string | null
    tenantId: string
    synapseId: string | null
    avatarUrl: string | null
    isAdmin: boolean
    onboardingComplete: boolean
    verificationStatus: string | null
    mustChangePassword: boolean
  }
  tenant: {
    id: string
    name: string
    slug: string
    facilityType: string
    status: string
    plan: string
    modulesEnabled: string[]
    isNetworkMember: boolean
    onboardingCompleted: boolean
  }
  app: AppSurface
  token: string
}

export async function getContext(
  app: AppSurface = 'web',
  redirectTo = '/login'
): Promise<SynapseContext> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) redirect(redirectTo)

  let payload: SynapseTokenPayload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect(redirectTo)
  }

  const { valid } = await validateSession(token)
  if (!valid) redirect(redirectTo)

  const { data: profile, error: profileError } = await (supabaseAdmin as any)
    .from('profiles')
    .select(`
      id, email, role, full_name, first_name, last_name,
      tenant_id, synapse_id, is_admin, onboarding_complete,
      verification_status, avatar_url, must_change_password,
      email_verified_at, is_deleted
    `)
    .eq('id', payload.sub)
    .single()

  if (profileError || !profile) redirect(redirectTo)
  if (!isAccountActivated(profile)) redirect(redirectTo)

  await assertSessionMatchesHost({
    role: profile.role as string,
    sessionTenantId: profile.tenant_id as string | null,
  })

  const user = {
    id: profile.id as string,
    email: profile.email as string,
    role: profile.role as SynapseRole,
    fullName: profile.full_name as string | null,
    firstName: profile.first_name as string | null,
    lastName: profile.last_name as string | null,
    tenantId: (profile.tenant_id as string | null) ?? '',
    synapseId: profile.synapse_id as string | null,
    avatarUrl: profile.avatar_url as string | null,
    isAdmin: (profile.is_admin as boolean) ?? false,
    onboardingComplete: (profile.onboarding_complete as boolean) ?? false,
    verificationStatus: profile.verification_status as string | null,
    mustChangePassword: (profile.must_change_password as boolean) ?? false,
  }

  // Platform admins are not scoped to a tenant
  if (profile.role === 'platform_admin' || profile.role === 'superadmin') {
    return {
      user,
      tenant: {
        id: '',
        name: 'Synapse Platform',
        slug: 'platform',
        facilityType: 'platform',
        status: 'active',
        plan: 'platform',
        modulesEnabled: [] as string[],
        isNetworkMember: false,
        onboardingCompleted: true,
      },
      app,
      token,
    }
  }

  if (!profile.tenant_id) redirect(redirectTo)

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select(`
      id, name, slug, facility_type, status, plan,
      modules_enabled, is_network_member, onboarding_completed
    `)
    .eq('id', profile.tenant_id as string)
    .single()

  if (tenantError || !tenant) redirect(redirectTo)

  return {
    user,
    tenant: {
      id: tenant.id as string,
      name: tenant.name as string,
      slug: tenant.slug as string,
      facilityType: tenant.facility_type as string,
      status: tenant.status as string,
      plan: tenant.plan as string,
      modulesEnabled: (tenant.modules_enabled as string[]) ?? [],
      isNetworkMember: (tenant.is_network_member as boolean) ?? false,
      onboardingCompleted: (tenant.onboarding_completed as boolean) ?? false,
    },
    app,
    token,
  }
}

export async function getContextSafe(app: AppSurface = 'web'): Promise<SynapseContext | null> {
  try {
    return await getContext(app, '__synapse_never_redirect__')
  } catch {
    return null
  }
}
