/** Host classification and tenant lookup shared by middleware and routing tests. */
export const RESERVED_HOSTS = new Set(['admin', 'app', 'www', 'pharm', 'api', 'status', 'docs', 'demo'])

export function sanitizedTenantHeaders(input: Headers): Headers {
  const headers = new Headers(input)
  for (const name of [...headers.keys()]) {
    if (name.startsWith('x-tenant-') || name === 'x-hospital-subdomain') headers.delete(name)
  }
  return headers
}

export function facilitySlugFromHost(host: string): string | null {
  const hostname = (host.toLowerCase().split(':')[0] ?? '').replace(/\.$/, '')
  if (!hostname.endsWith('.synapseos.tech')) return null
  const slug = hostname.slice(0, -'.synapseos.tech'.length)
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_HOSTS.has(slug) ? slug : null
}

export type RoutedTenant = { id: string; slug: string; facility_type: string; is_active: boolean; status: string }

export async function lookupActiveTenant(
  slug: string,
  config: { url?: string; key?: string },
  fetcher: typeof fetch = fetch,
): Promise<RoutedTenant | null> {
  if (!config.url || !config.key || RESERVED_HOSTS.has(slug)) return null
  const read = async (table: string, params: Record<string, string>) => {
    const url = new URL(`/rest/v1/${table}`, config.url)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const response = await fetcher(url, {
      headers: { apikey: config.key!, Authorization: `Bearer ${config.key}` },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Tenant lookup unavailable')
    return response.json()
  }
  try {
    const rows = await read('tenants', { slug: `eq.${slug}`, select: 'id,slug,facility_type,is_active,status', limit: '2' })
    if (!Array.isArray(rows) || rows.length !== 1) return null
    const tenant = rows[0] as RoutedTenant
    if (!tenant.id || tenant.slug !== slug || tenant.is_active !== true || tenant.status !== 'active') return null
    const runs = await read('facility_provisioning_runs', {
      tenant_id: `eq.${tenant.id}`, select: 'status', order: 'created_at.desc', limit: '1',
    })
    if (!Array.isArray(runs) || (runs.length && !['COMPLETE', 'READY_WITH_WARNINGS'].includes(runs[0].status))) return null
    return tenant
  } catch {
    return null
  }
}
