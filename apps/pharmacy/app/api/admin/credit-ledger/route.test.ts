import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ balance: 0 as number | null, inserts: [] as any[] }))
vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async () => ({ ok: true, session: { user: { id: "u-1" } }, tenantId: "tenant-1" })),
}))
vi.mock("@/lib/tenant-ownership", () => ({ tenantOwnsRecord: vi.fn(async () => true) }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let inserting: any = null
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        insert: (v: any) => ((inserting = v), m.inserts.push({ table, v }), q),
        maybeSingle: async () => ({ data: m.balance == null ? null : { balance_after: m.balance }, error: null }),
        single: async () => ({ data: { id: "e-1", ...inserting }, error: null }),
        then: (res: any) => Promise.resolve({ error: null }).then(res),
      }
      return q
    },
  },
}))

const post = async (body: unknown) => {
  const { POST } = await import("./route")
  const res = await POST({ json: async () => body } as any)
  return { status: res.status, body: await res.json() }
}
const ledgerInserts = () => m.inserts.filter((i) => i.table === "pharmacy_credit_ledger")

beforeEach(() => {
  m.inserts = []
  m.balance = 30000
})

describe("credit ledger repayments", () => {
  it("accepts a repayment up to the outstanding balance", async () => {
    const r = await post({ customerId: "c-1", type: "repayment", amount: 30000 })
    expect(r.status).toBe(201)
    expect(ledgerInserts()[0].v.balance_after).toBe(0)
  })
  it("rejects an overpayment instead of silently clamping the balance to 0", async () => {
    const r = await post({ customerId: "c-1", type: "repayment", amount: 30001 })
    expect(r.status).toBe(400)
    expect(r.body.code).toBe("OVERPAYMENT")
    expect(r.body.balance).toBe(30000)
    expect(ledgerInserts()).toEqual([])
  })
  it("rejects a repayment when nothing is owed", async () => {
    m.balance = null
    const r = await post({ customerId: "c-1", type: "repayment", amount: 1 })
    expect(r.status).toBe(400)
    expect(ledgerInserts()).toEqual([])
  })
  it("credit entries still add to the balance", async () => {
    const r = await post({ customerId: "c-1", type: "credit", amount: 500 })
    expect(r.status).toBe(201)
    expect(ledgerInserts()[0].v.balance_after).toBe(30500)
  })
})
