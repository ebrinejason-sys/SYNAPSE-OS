import { beforeEach, describe, expect, it, vi } from "vitest"

const A = "aaaaaaaa-0000-4000-8000-000000000001"
const SUP_A = "aaaaaaaa-0000-4000-8000-0000000000a1"
const SUP_B = "bbbbbbbb-0000-4000-8000-0000000000b1"
const PO_B = "bbbbbbbb-0000-4000-8000-0000000000c1"
const STORE_B = "bbbbbbbb-0000-4000-8000-0000000000d1"
const PROD_A = "aaaaaaaa-0000-4000-8000-0000000000f1"

const m = vi.hoisted(() => ({ writes: [] as Array<{ table: string; op: string }>, rpc: vi.fn() }))
const tables: Record<string, Array<Record<string, unknown>>> = {
  pharmacy_suppliers: [
    { id: SUP_A, tenant_id: A },
    { id: SUP_B, tenant_id: "tenant-b" },
  ],
  pharmacy_purchase_orders: [{ id: PO_B, tenant_id: "tenant-b" }],
  pharmacy_stores: [{ id: STORE_B, tenant_id: "tenant-b" }],
  pharmacy_products: [{ id: PROD_A, tenant_id: A, sku: "SKU-A" }],
}

vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async () => ({ ok: true, session: { user: { id: "u-a" }, storeId: null }, tenantId: A })),
}))
vi.mock("@/lib/pharmacy-context", () => ({
  requireStoreScope: (_a: unknown, storeId: string | null) => ({ ok: true, storeId }),
}))
vi.mock("@synapse/db/inventory-rpc", async (orig) => ({
  ...(await orig<any>()),
  receivePharmacyStock: (...args: unknown[]) => (m.rpc(...args), Promise.resolve({ data: { ok: true }, error: null })),
}))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const eqs: Record<string, unknown> = {}
      let op: string | null = null
      const rows = () => (tables[table] ?? []).filter((r) => Object.entries(eqs).every(([k, v]) => r[k] === v))
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => ((eqs[k] = v), q),
        neq: () => q,
        ilike: () => q,
        is: () => q,
        insert: () => ((op = "insert"), m.writes.push({ table, op }), q),
        update: () => ((op = "update"), m.writes.push({ table, op }), q),
        maybeSingle: async () => ({ data: op ? null : rows()[0] ?? null, error: null }),
        single: async () => ({ data: { id: PROD_A }, error: null }),
        then: (res: any) => Promise.resolve({ data: rows(), error: null }).then(res),
      }
      return q
    },
  },
}))

const req = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  m.writes = []
  m.rpc.mockReset()
})

describe("inventory supplier_id must belong to the caller's pharmacy", () => {
  it("POST with tenant B's supplier -> 404, nothing written", async () => {
    const { POST } = await import("./route")
    const res = await POST(req({ name: "X", sku: "NEW-1", price: 1, costPrice: 1, supplierId: SUP_B }))
    expect(res.status).toBe(404)
    expect(m.writes).toEqual([])
  })
  it("PATCH with tenant B's supplier -> 404, nothing written", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(req({ id: PROD_A, name: "X", sku: "SKU-A", price: 1, costPrice: 1, supplierId: SUP_B }))
    expect(res.status).toBe(404)
    expect(m.writes).toEqual([])
  })
  it("POST with a non-uuid supplier -> 404", async () => {
    const { POST } = await import("./route")
    const res = await POST(req({ name: "X", sku: "NEW-2", price: 1, costPrice: 1, supplierId: "' or 1=1 --" }))
    expect(res.status).toBe(404)
  })
  it("POST with own supplier proceeds to insert", async () => {
    const { POST } = await import("./route")
    await POST(req({ name: "X", sku: "NEW-3", price: 1, costPrice: 1, supplierId: SUP_A }))
    expect(m.writes.some((w) => w.table === "pharmacy_products" && w.op === "insert")).toBe(true)
  })
})

describe("receive: supplier / PO / store ids must belong to the caller's pharmacy", () => {
  const base = { productId: PROD_A, batchNumber: "B1", quantity: 5, expiryDate: "2099-01-01" }
  it.each([
    ["supplier", { supplierId: SUP_B }],
    ["purchase order", { purchaseOrderId: PO_B }],
    ["store", { storeId: STORE_B }],
  ])("foreign %s -> 404 and the RPC is never called", async (_l, extra) => {
    const { POST } = await import("./receive/route")
    const res = await POST(req({ ...base, ...extra }))
    expect(res.status).toBe(404)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it("own supplier reaches the RPC", async () => {
    const { POST } = await import("./receive/route")
    const res = await POST(req({ ...base, supplierId: SUP_A }))
    expect(res.status).toBe(200)
    expect(m.rpc).toHaveBeenCalledTimes(1)
  })
})
