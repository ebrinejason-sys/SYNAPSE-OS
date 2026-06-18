import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@synapse/db/admin'
import type { SynapseRole } from '@synapse/config/constants'

/**
 * When request arrives on a hospital subdomain (x-hospital-subdomain header set by middleware),
 * ensure the session tenant matches that hospital's tenant — prevents cross-tenant data leaks.
 */
export async function assertSessionMatchesHost(params: {
  role: SynapseRole | string
  sessionTenantId: string | null | undefined
}): Promise<void> {
  const { role, sessionTenantId } = params
  if (role === 'platform_admin' || role === 'superadmin') return
  if (!sessionTenantId) return

  const h = await headers()
  const subdomain = h.get('x-hospital-subdomain')?.trim()
  if (!subdomain) return

  const { data: hospital } = await (supabaseAdmin as any)
    .from('hospitals')
    .select('settings')
    .eq('subdomain', subdomain)
    .eq('is_deleted', false)
    .maybeSingle()

  const hostTenantId =
    (hospital?.settings as Record<string, string> | null)?.tenant_id ?? null

  if (hostTenantId && hostTenantId !== sessionTenantId) {
    redirect('/login?error=wrong_tenant')
  }
}
