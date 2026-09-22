import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const { requirePharmacyPermission, receivePharmacyPurchase } = vi.hoisted(() => ({
  requirePharmacyPermission: vi.fn(),
  receivePharmacyPurchase: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: (...args: unknown[]) => requirePharmacyPermission(...args),
}))

vi.mock("@/lib/pharmacy-context", () => ({
  requireStoreScope: () => ({ ok: true, storeId: null }),
}))

vi.mock("@synapse/db/pharmacy-purchases", async () => {
  const actual = await vi.importActual<typeof import("@synapse/db/pharmacy-purchases")>(
    "@synapse/db/pharmacy-purchases",
  )
  return {
    ...actual,
    receivePharmacyPurchase: (...args: unknown[]) => receivePharmacyPurchase(...args),
  }
})

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => {
      const api: Record<string, unknown> = {}
      const self = () => api
      api.select = self
      api.eq = self
      api.order = async () => ({ data: [], error: null })
      api.maybeSingle = async () => ({ data: null, error: null })
      return api
    },
  },
}))

import { POST } from "./route"

function auth(role: string, ok = true) {
  if (!ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: `Missing capability` }, { status: 403 }),
    }
  }
  return {
    ok: true as const,
    tenantId: "tenant-1",
    session: {
      user: { id: "user-1", email: "mgr@test.com" },
      userId: "user-1",
      email: "mgr@test.com",
      pharmacyRole: role,
      storeId: null,
      fullName: "Manager",
    },
  }
}

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("https://pharm.test/api/admin/purchases", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as any
}

describe("POST /api/admin/purchases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("forbids cashiers from receiving purchases", async () => {
    requirePharmacyPermission.mockResolvedValue(auth("pharmacy_cashier", false))
    const res = await POST(
      makeRequest({
        supplierId: "s1",
        lines: [
          {
            productId: "p1",
            productName: "Paracetamol",
            quantity: 10,
            unitCost: 100,
            batchNumber: "PAR-01",
            expiryDate: "2027-01-01",
          },
        ],
      }),
    )
    expect(res.status).toBe(403)
    expect(receivePharmacyPurchase).not.toHaveBeenCalled()
  })

  it("receives through the shared purchase domain and is idempotent", async () => {
    requirePharmacyPermission.mockResolvedValue(auth("pharmacy_store_manager"))
    receivePharmacyPurchase.mockResolvedValue({
      ok: true,
      replay: true,
      purchaseId: "pur-1",
      purchaseNo: "PUR-1",
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      grandTotal: 1000,
      amountPaid: 0,
      balance: 1000,
      received: [{ productId: "p1", batchId: "b1", quantity: 10, purchaseItemId: "i1" }],
    })
    const res = await POST(
      makeRequest(
        {
          supplierId: "s1",
          supplierInvoiceNo: "INV-1",
          lines: [
            {
              productId: "p1",
              productName: "Paracetamol",
              quantity: 10,
              unitCost: 100,
              batchNumber: "PAR-01",
              expiryDate: "2027-01-01",
            },
          ],
        },
        { "Idempotency-Key": "retry-1" },
      ),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.replay).toBe(true)
    expect(receivePharmacyPurchase).toHaveBeenCalledOnce()
    const input = receivePharmacyPurchase.mock.calls[0]?.[1]
    expect(input.tenantId).toBe("tenant-1")
    expect(input.idempotencyKey).toBe("retry-1")
    expect(input.lines[0].batchNumber).toBe("PAR-01")
  })
})
