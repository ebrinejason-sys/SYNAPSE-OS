// apps/pharmacy/lib/domain.ts
// Host-header based tenant resolution for the standalone pharmacy app.
//
// A request arriving on a mapped + verified custom domain resolves to that
// tenant_id. Base/platform hosts (localhost, *.vercel.app, pharm.synapseos.tech,
// etc.) are left untouched so default behavior is unchanged.
//
// Resolution is performed server-side with the service role. The middleware sets
// the x-tenant-id / x-tenant-domain request headers; downstream server code can
// read them via getResolvedTenantFromHeaders().

import { headers } from 'next/headers'
import { supabaseAdmin } from './supabase/admin'

export const RESOLVED_TENANT_HEADER = 'x-tenant-id'
export const RESOLVED_DOMAIN_HEADER = 'x-tenant-domain'

/** Strip port + lowercase. Returns '' for empty input. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return ''
  return host.split(':')[0]!.trim().toLowerCase()
}

/**
 * Base/managed hosts that must NEVER be treated as a custom tenant domain.
 * These keep the default (session-driven) behavior.
 */
export function isBaseHost(host: string): boolean {
  const h = normalizeHost(host)
  if (!h) return true
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true
  if (h.endsWith('.localhost')) return true
  if (h.endsWith('.vercel.app')) return true
  if (h === 'synapseos.tech' || h.endsWith('.synapseos.tech')) return true
  return false
}

export type ResolvedTenant = { tenantId: string; domain: string }

/**
 * Resolve a Host header to a tenant via the pharmacy_custom_domains table.
 * Only VERIFIED mappings resolve. Returns null for base hosts / unknown hosts.
 */
export async function resolveTenantIdFromHost(
  host: string | null | undefined,
): Promise<ResolvedTenant | null> {
  const h = normalizeHost(host)
  if (!h || isBaseHost(h)) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('pharmacy_custom_domains')
    .select('tenant_id, domain, verified')
    .eq('domain', h)
    .eq('verified', true)
    .maybeSingle()

  if (error || !data?.tenant_id) return null
  return { tenantId: data.tenant_id as string, domain: h }
}

/**
 * Read the tenant the middleware resolved from the custom domain (if any).
 * Returns null on base/default domains — callers should then fall back to the
 * session tenant, preserving existing behavior.
 */
export async function getResolvedTenantFromHeaders(): Promise<ResolvedTenant | null> {
  const h = await headers()
  const tenantId = h.get(RESOLVED_TENANT_HEADER)
  if (!tenantId) return null
  return { tenantId, domain: h.get(RESOLVED_DOMAIN_HEADER) ?? '' }
}
