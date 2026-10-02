import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), sendEmail: vi.fn(), update: vi.fn(), audit: vi.fn(), eq: vi.fn(),
  promotion: { data: null, error: null } as { data: Record<string, unknown> | null; error: unknown },
}))
vi.mock('@/lib/auth', () => ({ isPharmacyAdmin: () => true }))
vi.mock('@/lib/api-auth', () => ({
  requirePharmacyPermission: async () => ({
    ok: true, tenantId: 'tenant-a', session: { user: { id: 'actor' }, fullName: 'Buyer' },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@synapse/db/pharmacy-purchases', () => ({ receivePharmacyPurchase: vi.fn() }))

async function create(extra: Record<string, unknown> = {}, productName = 'Test item') {
  const { POST } = await import('./route')
  return POST(new Request('https://example.test/api/admin/purchase-orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ supplierId: 'supplier', sendEmailToSupplier: true,
      items: [{ productName, quantity: 2, unitPrice: 10 }], ...extra }),
  }) as any)
}

describe('purchase order email status persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendEmail.mockResolvedValue({ success: true })
    mocks.promotion = { data: { id: 'po', order_no: 'PO-1', status: 'SENT', total_amount: 20 }, error: null }
    mocks.from.mockImplementation((table: string) => {
      let updating = false
      const query: any = {
        select: () => query,
        eq: (...args: unknown[]) => { mocks.eq(...args); return query },
        insert: (row: unknown) => { if (table === 'pharmacy_audit_logs') mocks.audit(row); return query },
        update: (row: unknown) => { updating = true; mocks.update(row); return query },
        single: async () => {
          if (table === 'pharmacy_suppliers') return { data: { id: 'supplier', name: 'Supplier', email: 'supplier@example.test' }, error: null }
          if (updating) return mocks.promotion
          return { data: { id: 'po', order_no: 'PO-1', status: 'DRAFT', total_amount: 20 }, error: null }
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }
      return query
    })
  })

  it('reports SENT only after the tenant-scoped update returns the saved row', async () => {
    const response = await create()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.purchaseOrder.status).toBe('SENT')
    expect(body.warning).toBeUndefined()
    expect(mocks.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ email_sent: true, status: 'SENT' }))
  })

  it.each([
    { data: null, error: { message: 'write failed' } },
    { data: null, error: null },
  ])('warns without claiming SENT when promotion fails: %j', async (promotion) => {
    mocks.promotion = promotion
    const body = await (await create()).json()
    expect(body.success).toBe(true) // The order exists; do not encourage duplicate creation.
    expect(body.purchaseOrder.status).toBe('DRAFT')
    expect(body.warning).toContain('email was accepted')
    expect(body.warning).toContain('confirm with the supplier before resending')
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.stringContaining('delivery status could not be saved'),
    }))
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('keeps the order DRAFT and offers retry when the email provider rejects it', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false })
    const body = await (await create()).json()
    expect(body.purchaseOrder.status).toBe('DRAFT')
    expect(body.warning).toContain('could not be delivered')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('HTML-escapes product names and notes in the supplier email', async () => {
    await create({ notes: '<img src=x onerror=alert(1)>' }, '<script>alert("po")</script>')
    const html = String(mocks.sendEmail.mock.calls[0][0].html)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;alert(&quot;po&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('purchase order resend (PATCH resendEmail)', () => {
  const po = {
    id: 'po', order_no: 'PO-9', total_amount: 20, email_sent: true, status: 'SENT', supplier_id: 'supplier',
    supplier: { name: 'Supplier', email: 'supplier@example.test', contact_person: null },
    items: [{ id: 'i1', product_id: 'p1', product_name: 'Item', quantity: 2, received_quantity: 0, unit_price: 10, total_price: 20 }],
  }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockImplementation(() => {
      let updating = false
      const query: any = {
        select: () => query,
        eq: (...args: unknown[]) => { mocks.eq(...args); return query },
        insert: () => query,
        update: (row: unknown) => { updating = true; mocks.update(row); return query },
        single: async () => (updating ? { data: { ...po }, error: null } : { data: po, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }
      return query
    })
  })

  async function resend() {
    const { PATCH } = await import('./route')
    return PATCH(new Request('https://example.test/api/admin/purchase-orders', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'po', resendEmail: true }),
    }) as any)
  }

  it('a provider failure on resend returns 502 and never records the email as sent', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: 'provider down' })
    const res = await resend()
    expect(res.status).toBe(502)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('a successful resend records email_sent with a fresh timestamp', async () => {
    mocks.sendEmail.mockResolvedValue({ success: true })
    const res = await resend()
    expect(res.status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'supplier@example.test' }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ email_sent: true, email_sent_at: expect.any(String) }))
  })
})
