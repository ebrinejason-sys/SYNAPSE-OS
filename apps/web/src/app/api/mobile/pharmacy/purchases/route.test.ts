import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const { requireMobilePharmacyAuth, isMobileAuth, mobileHasPharmacyCapability, receivePharmacyPurchase } = vi.hoisted(() => ({
  requireMobilePharmacyAuth: vi.fn(),
  isMobileAuth: vi.fn(),
  mobileHasPharmacyCapability: vi.fn(),
  receivePharmacyPurchase: vi.fn(),
}))

vi.mock("../../../../../lib/mobile-pharmacy-auth", () => ({
  requireMobilePharmacyAuth: (...args: unknown[]) => requireMobilePharmacyAuth(...args),
  isMobileAuth: (...args: unknown[]) => isMobileAuth(...args),
  mobileHasPharmacyCapability: (...args: unknown[]) => mobileHasPharmacyCapability(...args),
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

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => {
      const api: Record<string, unknown> = {}
      const self = () => api
      api.select = self
      api.eq = self
      api.order = self
      api.limit = async () => ({ data: [], error: null })
      return api
    },
  },
}))

import { POST } from "./route"

function auth(role: string, tenantId = "tenant-a") {
  return { userId: "user-1", tenantId, role, token: "t" }
}

function body() {
  return {
    supplierId: "s1",
    idempotencyKey: "retry-1",
    lines: [
      {
        clientItemId: "line-para",
        productId: "para",
        productName: "Paracetamol",
        quantity: 500,
        unitCost: 200,
        batchNumber: "PAR-01",
        expiryDate: "2027-01-01",
      },
      {
        clientItemId: "line-cet",
        productId: "cet-1",
        productName: "Cetirizine 10 mg Tablet",
        quantity: 200,
        unitCost: 350,
        batchNumber: "CET-44",
        expiryDate: "2027-06-01",
      },
    ],
  }
}

describe("POST /api/mobile/pharmacy/purchases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobileAuth.mockImplementation((value: unknown) => Boolean(value) && typeof value === "object" && "tenantId" in (value as object))
    mobileHasPharmacyCapability.mockImplementation((_a: unknown, cap: string) => cap === "purchasing.manage")
  })

  it("receives a mixed purchase for the auth tenant", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist"))
    receivePharmacyPurchase.mockResolvedValue({
      ok: true,
      purchaseId: "p1",
      purchaseNo: "PUR-1",
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      grandTotal: 170000,
      amountPaid: 0,
      balance: 170000,
      received: [
        { productId: "para", batchId: "b1", quantity: 500, purchaseItemId: "i1" },
        { productId: "cet-1", batchId: "b2", quantity: 200, purchaseItemId: "i2" },
      ],
    })
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": "retry-1" },
        body: JSON.stringify(body()),
      }) as never,
    )
    expect(res.status).toBe(200)
    const input = receivePharmacyPurchase.mock.calls[0]?.[1]
    expect(input.tenantId).toBe("tenant-a")
    expect(input.lines).toHaveLength(2)
    expect(input.lines[0].productId).toBe("para")
    expect(input.lines[1].productId).toBe("cet-1")
  })

  it("replays the same idempotency key without a second receive payload change", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist"))
    receivePharmacyPurchase.mockResolvedValue({
      ok: true,
      replay: true,
      purchaseId: "p1",
      purchaseNo: "PUR-1",
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      grandTotal: 170000,
      amountPaid: 0,
      balance: 170000,
      received: [],
    })
    const req = () =>
      POST(
        new Request("https://app.test/api/mobile/pharmacy/purchases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body()),
        }) as never,
      )
    const first = await req()
    const second = await req()
    expect((await first.json()).replay).toBe(true)
    expect((await second.json()).replay).toBe(true)
    expect(receivePharmacyPurchase).toHaveBeenCalledTimes(2)
    expect(receivePharmacyPurchase.mock.calls[0]?.[1].idempotencyKey).toBe("retry-1")
    expect(receivePharmacyPurchase.mock.calls[1]?.[1].idempotencyKey).toBe("retry-1")
  })

  it("denies cashier purchase receive", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacy_cashier"))
    mobileHasPharmacyCapability.mockReturnValue(false)
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body(), tenant_id: "tenant-b" }),
      }) as never,
    )
    expect(res.status).toBe(403)
    expect(receivePharmacyPurchase).not.toHaveBeenCalled()
  })

  it("ignores client tenant_id and uses authenticated tenant", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist", "tenant-a"))
    receivePharmacyPurchase.mockResolvedValue({
      ok: true,
      purchaseId: "p1",
      purchaseNo: "PUR-1",
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      grandTotal: 170000,
      amountPaid: 0,
      balance: 170000,
      received: [],
    })
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body(), tenant_id: "tenant-b" }),
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(receivePharmacyPurchase.mock.calls[0]?.[1].tenantId).toBe("tenant-a")
  })
})
