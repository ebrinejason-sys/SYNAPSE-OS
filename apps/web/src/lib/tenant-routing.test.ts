import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { facilitySlugFromHost, lookupActiveTenant } from './tenant-routing'
vi.mock('@synapse/auth/tokens', () => ({ verifyToken: vi.fn(async () => ({ sub: 'user-a', tenant_id: 'facility-a' })) }))
vi.mock('@synapse/config/constants', () => ({ SESSION_COOKIE: 'synapse_session' }))
import { middleware } from '../middleware'
const tenant = { id: 'facility-a', slug: 'facility-a', facility_type: 'hospital', status: 'active', is_active: true }
function mockFetch(row: unknown = tenant, runStatus = 'COMPLETE') {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    return Response.json(url.includes('/synapse_sessions') ? [{ user_id: 'user-a', expires_at: '2099-01-01' }] : url.includes('/facility_provisioning_runs') ? [{ status: runStatus }] : row ? [row] : [])
  })
}
function request(host: string, path = '/', cookie = false) {
  return new NextRequest(`https://${host}${path}`, { headers: {
    host, 'x-tenant-id': 'facility-b', 'x-tenant-slug': 'facility-b', 'x-tenant-type': 'pharmacy',
    'x-tenant-subdomain': 'facility-b', 'x-hospital-subdomain': 'facility-b',
    ...(cookie ? { cookie: 'synapse_session=test' } : {}),
  } })
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
function setup(row: unknown = tenant, runStatus = 'COMPLETE') {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key')
  const fetcher = mockFetch(row, runStatus)
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
describe('host-derived tenant boundary', () => {
  it('resolves the host tenant on APIs despite every spoofed tenant header', async () => {
    const f = setup()
    const res = await middleware(request('facility-a.synapseos.tech', '/api/lab/orders', true))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBe('facility-a')
    expect(res.headers.get('x-middleware-request-x-hospital-subdomain')).toBe('facility-a')
    expect(res.headers.get('x-middleware-request-x-tenant-subdomain')).toBeNull()
    expect(f.mock.calls.some(([u]) => String(u).includes('facility-b'))).toBe(false)
  })
  it('rejects a host/path tenant mismatch', async () => {
    setup()
    expect((await middleware(request('facility-a.synapseos.tech', '/os/facility-b/patients'))).status).toBe(404)
  })
  it.each([null, { ...tenant, is_active: false }, { ...tenant, status: 'failed' }])('fails closed for unknown/inactive/failed tenants', async row => {
    setup(row)
    expect((await middleware(request('facility-a.synapseos.tech', '/api/lab/orders'))).status).toBe(404)
  })
  it('rejects a FAILED provisioning run even if tenant active was set incorrectly', async () => {
    setup(tenant, 'FAILED')
    expect((await middleware(request('facility-a.synapseos.tech'))).status).toBe(404)
  })
  it('fails closed on lookup outages and missing configuration', async () => {
    expect(await lookupActiveTenant('facility-a', {})).toBeNull()
    expect(await lookupActiveTenant('facility-a', { url: 'https://db.test', key: 'test' }, vi.fn(async () => { throw new Error('offline') }))).toBeNull()
  })
  it.each(['admin', 'app', 'www', 'pharm', 'api', 'status', 'docs', 'demo'])('reserves %s', async slug => {
    expect(facilitySlugFromHost(`${slug}.synapseos.tech`)).toBeNull()
    setup()
    const res = await middleware(request(`${slug}.synapseos.tech`, '/api/example'))
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBeNull()
  })

  it('does not rewrite health/ready under managed shells or www/apex', async () => {
    setup()
    for (const host of [
      'www.synapseos.tech',
      'synapseos.tech',
      'admin.synapseos.tech',
      'demo.synapseos.tech',
      'pharm.synapseos.tech',
    ]) {
      for (const path of ['/api/health/live', '/api/ready']) {
        const res = await middleware(request(host, path))
        expect(res.headers.get('x-middleware-rewrite')).toBeNull()
        expect(res.status).toBe(200)
        expect(res.headers.get('x-middleware-request-x-tenant-id')).toBeNull()
      }
    }
  })

  it('serves health/ready on facility hosts without tenant lookup or shell rewrite', async () => {
    const f = setup(null)
    for (const path of ['/api/health/live', '/api/ready']) {
      const res = await middleware(request('unknown-random.synapseos.tech', path))
      expect(res.status).toBe(200)
      expect(res.headers.get('x-middleware-rewrite')).toBeNull()
      expect(res.headers.get('x-middleware-request-x-tenant-id')).toBeNull()
    }
    expect(f).not.toHaveBeenCalled()
  })
  it.each(['synapseos.tech', 'www.synapseos.tech', 'localhost', 'preview.vercel.app'])('does not resolve root/preview %s from query input', async host => {
    expect(facilitySlugFromHost(host)).toBeNull()
    setup()
    const res = await middleware(request(host, '/api/example?subdomain=facility-b'))
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBeNull()
  })
  it('static assets stay available without forwarding spoofed headers', async () => {
    const f = setup()
    const res = await middleware(request('unknown-random.synapseos.tech', '/_next/static/chunk.js'))
    expect(res.status).toBe(200)
    expect(f).not.toHaveBeenCalled()
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBeNull()
  })
  it('an API path ending in an asset extension still enforces the tenant boundary', async () => {
    setup(null)
    expect((await middleware(request('unknown-random.synapseos.tech', '/api/orders/order.js'))).status).toBe(404)
  })
  it('rejects a valid session belonging to another tenant', async () => {
    setup({ ...tenant, id: 'facility-b' })
    expect((await middleware(request('facility-a.synapseos.tech', '/api/lab/orders', true))).status).toBe(403)
  })
  it('requires login before serving an active tenant page', async () => {
    setup()
    const res = await middleware(request('facility-a.synapseos.tech'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
  it('preserves the tenant shell route for its authenticated member', async () => {
    setup()
    const res = await middleware(request('facility-a.synapseos.tech', '/os/facility-a/dashboard', true))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })
})
