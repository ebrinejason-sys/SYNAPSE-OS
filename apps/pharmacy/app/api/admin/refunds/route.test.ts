import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const m = vi.hoisted(() => ({
  reverse: vi.fn(),
  attach: vi.fn(async () => ({ ok: true })),
}))

vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async () => ({ ok: true, tenantId: "tenant-1", session: { user: { id: "manager-1" } } })),
}))
vi.mock("@/lib/api-serialize", () => ({ mapRefund: (r: unknown) => r }))
vi.mock("@synapse/db/inventory-rpc", () => ({ reversePharmacySale: m.reverse }))
vi.mock("@/lib/pos/till-service", () => ({ attachSaleToTill: m.attach }))
vi.mock("@/lib/supabase/admin", () => {
  const q: any = {
    select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: { payment_method: "CASH", cashier_id: "cashier-9" }, error: null }),
    single: async () => ({ data: null, error: { message: "not found" } }),
  }
  return { supabaseAdmin: { from: () => q } }
})

import { POST } from "./route"

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/admin/refunds", { method: "POST", body: JSON.stringify(body) }))

describe("POST /api/admin/refunds — till treatment", () => {
  beforeEach(() => {
    m.reverse.mockReset()
    m.attach.mockClear()
  })

  it("a committed refund reverses cash exactly once, keyed by the sale, for the original cashier", async () => {
    m.reverse.mockResolvedValue({ data: { refund_amount: 2500 }, error: null })
    const res = await post({ saleId: "sale-1", reason: "Wrong item" })
    expect(res.status).toBe(200)
    expect(m.attach).toHaveBeenCalledTimes(1)
    expect(m.attach).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "refund", amount: 2500, sourceId: "refund:sale-1", cashierId: "cashier-9", tenantId: "tenant-1" }),
    )
  })

  it("an already-refunded sale (retry) is refused and touches no cash", async () => {
    m.reverse.mockResolvedValue({ data: null, error: { code: "ALREADY_REFUNDED", humanMessage: "Already refunded" } })
    const res = await post({ saleId: "sale-1", reason: "Wrong item" })
    expect(res.status).toBe(409)
    expect(m.attach).not.toHaveBeenCalled()
  })

  it("a failed reversal touches no cash", async () => {
    m.reverse.mockResolvedValue({ data: null, error: { code: "DB_ERROR", humanMessage: "Failed" } })
    const res = await post({ saleId: "sale-1", reason: "Wrong item" })
    expect(res.status).toBe(400)
    expect(m.attach).not.toHaveBeenCalled()
  })

  it("a refund without a reason is rejected before any reversal or cash", async () => {
    const res = await post({ saleId: "sale-1" })
    expect(res.status).toBe(400)
    expect(m.reverse).not.toHaveBeenCalled()
    expect(m.attach).not.toHaveBeenCalled()
  })
})
