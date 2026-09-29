import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createTenantDbMock } from '@/lib/test-utils/tenant-db-mock'

/**
 * Customer portal identity must come from a server-signed session cookie,
 * never from a client-supplied x-customer-id header.
 */
const h = vi.hoisted(() => ({ db: null as any }))
vi.mock('@/lib/supabase/admin', () => ({
  get supabaseAdmin() {
    return h.db.client
  },
}))

process.env.SYNAPSE_JWT_SECRET = 'test-secret-for-customer-session-0123456789'

import { GET, POST } from './route'
import { POST as AUTH } from '../auth/route'
import { CUSTOMER_SESSION_COOKIE, signCustomerSession, verifyCustomerSession } from '@/lib/customer-session'

function seed() {
  h.db = createTenantDbMock()
  h.db.state.tables = {
    pharmacy_customers: [
      { id: 'cust-a', tenant_id: 'tenant-a', name: 'A', email: 'a@a.test', is_active: true, password_hash: null },
      { id: 'cust-b', tenant_id: 'tenant-b', name: 'B', email: 'b@b.test', is_active: true },
    ],
    pharmacy_orders: [
      { id: 'ord-a', tenant_id: 'tenant-a', customer_id: 'cust-a', claimed_by: null, is_online_order: true },
      { id: 'ord-b', tenant_id: 'tenant-b', customer_id: 'cust-b', claimed_by: null, is_online_order: true },
    ],
    pharmacy_products: [{ id: 'prod-a', tenant_id: 'tenant-a', name: 'P', price: 100, quantity: 10, is_active: true }],
    profiles: [],
  }
}

function req(method: string, opts: { cookie?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) }
  if (opts.cookie) headers.cookie = `${CUSTOMER_SESSION_COOKIE}=${opts.cookie}`
  return new NextRequest('https://pharmacy.test/api/customer/orders', {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

describe('customer portal session', () => {
  beforeEach(seed)

  it('rejects a spoofed x-customer-id / x-tenant-id header with no session', async () => {
    const res = await GET(req('GET', { headers: { 'x-customer-id': 'cust-b', 'x-tenant-id': 'tenant-b' } }))
    expect(res.status).toBe(401)
    const post = await POST(req('POST', {
      headers: { 'x-customer-id': 'cust-b', 'x-tenant-id': 'tenant-b' },
      body: { items: [{ productId: 'prod-a', quantity: 1 }] },
    }))
    expect(post.status).toBe(401)
  })

  it('rejects a forged or tampered session cookie', async () => {
    const good = signCustomerSession({ customerId: 'cust-a', tenantId: 'tenant-a' })
    const [, sig] = good.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ c: 'cust-b', t: 'tenant-b', e: Date.now() + 1e6 })).toString('base64url')
    expect((await GET(req('GET', { cookie: `${forgedPayload}.${sig}` }))).status).toBe(401)
    expect((await GET(req('GET', { cookie: 'garbage' }))).status).toBe(401)
  })

  it('rejects an expired session', () => {
    const t = signCustomerSession({ customerId: 'cust-a', tenantId: 'tenant-a', now: Date.now() - 13 * 3600 * 1000 })
    expect(verifyCustomerSession(t)).toBeNull()
  })

  it('rejects a session from another pharmacy on a custom-domain tenant', async () => {
    const tokenB = signCustomerSession({ customerId: 'cust-b', tenantId: 'tenant-b' })
    const res = await GET(req('GET', { cookie: tokenB, headers: { 'x-tenant-id': 'tenant-a' } }))
    expect(res.status).toBe(401)
  })

  it('returns only the session customer\'s orders, ignoring a spoofed header', async () => {
    const tokenA = signCustomerSession({ customerId: 'cust-a', tenantId: 'tenant-a' })
    const res = await GET(req('GET', { cookie: tokenA, headers: { 'x-customer-id': 'cust-b' } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.map((o: { id: string }) => o.id)).toEqual(['ord-a'])
  })

  it('rejects non-positive item quantities', async () => {
    const tokenA = signCustomerSession({ customerId: 'cust-a', tenantId: 'tenant-a' })
    const res = await POST(req('POST', { cookie: tokenA, body: { items: [{ productId: 'prod-a', quantity: -5 }] } }))
    expect(res.status).toBe(400)
  })

  it('login issues an httpOnly session cookie and logout clears it', async () => {
    const { createHash } = await import('node:crypto')
    h.db.state.tables.pharmacy_customers[0].password_hash = createHash('sha256').update('pw-a').digest('hex')
    const login = await AUTH(new NextRequest('https://pharmacy.test/api/customer/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login', email: 'a@a.test', password: 'pw-a', tenant_id: 'tenant-a' }),
    }))
    expect(login.status).toBe(200)
    const setCookie = login.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(CUSTOMER_SESSION_COOKIE)
    expect(setCookie.toLowerCase()).toContain('httponly')
    const logout = await AUTH(new NextRequest('https://pharmacy.test/api/customer/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }))
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i)
  })
})
