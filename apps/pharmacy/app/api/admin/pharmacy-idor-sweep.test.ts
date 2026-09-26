import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTenantDbMock } from '@/lib/test-utils/tenant-db-mock'

/**
 * IDOR/BOLA sweep regression tests: a tenant-A actor supplying tenant-B ids
 * (directly or as foreign-key references) must not mutate, reference or leak
 * tenant-B records.
 */
const h = vi.hoisted(() => ({ db: null as any, sendEmail: vi.fn(async () => ({ success: true })) }))

vi.mock('@/lib/supabase/admin', () => ({
  get supabaseAdmin() {
    return h.db.client
  },
}))
const session = {
  userId: 'admin-a',
  user: { id: 'admin-a', email: 'admin@a.test' },
  profile: { tenant_id: 'tenant-a', full_name: 'Admin A' },
  tenantId: 'tenant-a',
  storeId: null,
}
vi.mock('@/lib/api-auth', () => {
  const ok = async () => ({ ok: true, session, tenantId: 'tenant-a' })
  return { requirePharmacyAdmin: ok, requirePharmacyPermission: ok, requirePharmacyTenant: ok }
})
vi.mock('@/lib/auth', () => ({ getPharmacySession: async () => session, isPharmacyAdmin: () => true }))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail, generateWelcomeEmail: () => '' }))

function seed() {
  h.db = createTenantDbMock()
  h.db.state.tables = {
    pharmacy_inquiries: [
      { id: 'inq-a', tenant_id: 'tenant-a', user_email: 'cust@a.test', user_name: 'A', subject: 's' },
      { id: 'inq-b', tenant_id: 'tenant-b', user_email: 'cust@b.test', user_name: 'B', subject: 's' },
      { id: 'inq-platform', tenant_id: null, user_email: 'someone@x.test', user_name: 'X', subject: 's' },
    ],
    pharmacy_customers: [
      { id: 'cust-a', tenant_id: 'tenant-a', name: 'Cust A', email: 'cust@a.test' },
      { id: 'cust-b', tenant_id: 'tenant-b', name: 'Cust B', email: 'cust@b.test' },
    ],
    pharmacy_transactions: [
      { id: 'txn-a', tenant_id: 'tenant-a' },
      { id: 'txn-b', tenant_id: 'tenant-b' },
    ],
    pharmacy_products: [
      { id: 'prod-a', tenant_id: 'tenant-a', quantity: 100, name: 'Paracetamol' },
    ],
  }
}

function req(url: string, method: string, body?: unknown) {
  return new Request(`https://pharm.synapseos.tech${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as any
}
const writesTo = (table: string) => h.db.state.writes.filter((w: any) => w.table === table)

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})

describe('PATCH /api/admin/inquiries', () => {
  it.each([['tenant B inquiry', 'inq-b'], ['platform-level inquiry', 'inq-platform'], ['unknown id', 'nope']])(
    'refuses %s with 404, no write, no email',
    async (_l, id) => {
      const { PATCH } = await import('./inquiries/route')
      const res = await PATCH(req('/api/admin/inquiries', 'PATCH', { id, status: 'RESOLVED', adminResponse: 'hi' }))
      expect(res.status).toBe(404)
      expect(writesTo('pharmacy_inquiries')).toEqual([])
      expect(h.sendEmail).not.toHaveBeenCalled()
    },
  )

  it('updates an own-tenant inquiry with a tenant-filtered update', async () => {
    const { PATCH } = await import('./inquiries/route')
    const res = await PATCH(req('/api/admin/inquiries', 'PATCH', { id: 'inq-a', status: 'IN_PROGRESS' }))
    expect(res.status).toBe(200)
    expect(writesTo('pharmacy_inquiries')[0].filters).toEqual({ id: 'inq-a', tenant_id: 'tenant-a' })
  })
})

describe('POST /api/admin/refills (customer reference)', () => {
  it('refuses a tenant B customerId (would leak B customer PII through the GET join)', async () => {
    const { POST } = await import('./refills/route')
    const res = await POST(req('/api/admin/refills', 'POST', { customerId: 'cust-b', drugName: 'X', refillDueDate: '2026-10-01' }))
    expect(res.status).toBe(404)
    expect(writesTo('refill_reminders')).toEqual([])
  })

  it('accepts an own-tenant customer', async () => {
    const { POST } = await import('./refills/route')
    const res = await POST(req('/api/admin/refills', 'POST', { customerId: 'cust-a', drugName: 'X', refillDueDate: '2026-10-01' }))
    expect(res.status).toBe(201)
  })
})

describe('POST /api/admin/credit-ledger (customer/transaction reference)', () => {
  it.each([
    ['tenant B customer', { customerId: 'cust-b', type: 'credit', amount: 100 }],
    ['tenant B transaction', { customerId: 'cust-a', type: 'credit', amount: 100, transactionId: 'txn-b' }],
  ])('refuses %s with 404 and no ledger write', async (_l, body) => {
    const { POST } = await import('./credit-ledger/route')
    const res = await POST(req('/api/admin/credit-ledger', 'POST', body))
    expect(res.status).toBe(404)
    expect(writesTo('pharmacy_credit_ledger')).toEqual([])
  })

  it('accepts an own-tenant customer and transaction', async () => {
    const { POST } = await import('./credit-ledger/route')
    const res = await POST(req('/api/admin/credit-ledger', 'POST', { customerId: 'cust-a', type: 'credit', amount: 100, transactionId: 'txn-a' }))
    expect(res.status).toBe(201)
  })
})

describe('POST /api/admin/orders (customer reference)', () => {
  it('refuses a tenant B customerId with 404 and no order write', async () => {
    const { POST } = await import('./orders/route')
    const res = await POST(req('/api/admin/orders', 'POST', {
      customerId: 'cust-b', orderType: 'CUSTOMER', items: [{ productId: 'prod-a', quantity: 1, unitPrice: 10 }],
    }))
    expect(res.status).toBe(404)
    expect(writesTo('pharmacy_orders')).toEqual([])
  })
})
