import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const {
  requireMobilePharmacyAuth,
  isMobileAuth,
  mobileHasPharmacyCapability,
  createPurchaseCatalogProduct,
  matchCatalogProducts,
  catalogByTenant,
} = vi.hoisted(() => ({
  requireMobilePharmacyAuth: vi.fn(),
  isMobileAuth: vi.fn(),
  mobileHasPharmacyCapability: vi.fn(),
  createPurchaseCatalogProduct: vi.fn(),
  matchCatalogProducts: vi.fn(),
  catalogByTenant: {
    "tenant-a": [{ id: "para", name: "Paracetamol", sku: "PARA-500", barcode: "1234567890123", tenant_id: "tenant-a" }],
    "tenant-b": [{ id: "secret", name: "Secret B", sku: "SEC-B", barcode: "9999999999999", tenant_id: "tenant-b" }],
  } as Record<string, Array<Record<string, unknown>>>,
}))

vi.mock("../../../../../../lib/mobile-pharmacy-auth", () => ({
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
    createPurchaseCatalogProduct: (...args: unknown[]) => createPurchaseCatalogProduct(...args),
    matchCatalogProducts: (...args: unknown[]) => matchCatalogProducts(...args),
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => {
      const filters: Record<string, string> = {}
      const api: Record<string, unknown> = {}
      const self = () => api
      api.select = self
      api.eq = (column: string, value: string) => {
        filters[column] = value
        return api
      }
      api.limit = async () => ({
        data: catalogByTenant[filters.tenant_id] ?? [],
        error: null,
      })
      return api
    },
  },
}))

import { GET, POST } from "./route"

function auth(role: string, tenantId = "tenant-a") {
  return { userId: "user-1", tenantId, role, token: "t" }
}

function caps(role: string) {
  mobileHasPharmacyCapability.mockImplementation((_auth: unknown, cap: string) => {
    if (role === "pharmacy_cashier" || role === "cashier") return cap === "inventory.read"
    return cap === "purchasing.manage" || cap === "inventory.read" || cap === "inventory.write"
  })
}

describe("mobile purchase products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobileAuth.mockImplementation(
      (value: unknown) =>
        !(value instanceof NextResponse) && Boolean(value) && typeof value === "object" && "userId" in (value as object),
    )
  })

  it("denies unauthenticated search", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    isMobileAuth.mockReturnValue(false)
    const res = await GET(new Request("https://app.test/api/mobile/pharmacy/purchases/products?q=para") as never)
    expect(res.status).toBe(401)
    expect(matchCatalogProducts).not.toHaveBeenCalled()
  })

  it("scopes name/barcode/sku search to the authenticated tenant", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist", "tenant-a"))
    caps("pharmacist")
    matchCatalogProducts.mockReturnValue([{ id: "para", name: "Paracetamol", score: 100, existing: true }])
    const res = await GET(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products?q=para&barcode=1234567890123&sku=PARA-500") as never,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.matches[0].id).toBe("para")
    const [, rows, limit] = matchCatalogProducts.mock.calls[0]
    expect(rows).toEqual(catalogByTenant["tenant-a"])
    expect(rows.find((row: { id: string }) => row.id === "secret")).toBeUndefined()
    expect(limit).toBe(12)
  })

  it("does not leak a Tenant B barcode into Tenant A search", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist", "tenant-a"))
    caps("pharmacist")
    matchCatalogProducts.mockImplementation((_q: unknown, rows: Array<{ barcode?: string }>) =>
      rows
        .filter((row) => row.barcode === "9999999999999")
        .map((row) => ({ ...row, score: 100, existing: true })),
    )
    const res = await GET(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products?barcode=9999999999999") as never,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.matches).toEqual([])
  })

  it("denies cashier product creation even with createAnyway", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacy_cashier"))
    caps("pharmacy_cashier")
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Cetirizine", createAnyway: true, tenant_id: "tenant-b" }),
      }) as never,
    )
    expect(res.status).toBe(403)
    expect(createPurchaseCatalogProduct).not.toHaveBeenCalled()
  })

  it("creates a catalog product for an authorized purchasing user", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist", "tenant-a"))
    caps("pharmacist")
    createPurchaseCatalogProduct.mockResolvedValue({
      ok: true,
      duplicateOverride: false,
      product: {
        id: "cet-1",
        name: "Cetirizine 10 mg Tablet",
        sku: "CET-10",
        barcode: "6281001234567",
        price: 500,
        costPrice: 0,
        genericName: "Cetirizine",
        strength: "10 mg",
        dosageForm: "Tablet",
        manufacturer: null,
      },
    })
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Cetirizine 10 mg Tablet",
          genericName: "Cetirizine",
          barcode: "6281001234567",
          tenant_id: "tenant-b",
          quantity: 200,
        }),
      }) as never,
    )
    expect(res.status).toBe(200)
    const input = createPurchaseCatalogProduct.mock.calls[0]?.[1]
    expect(input.tenantId).toBe("tenant-a")
    expect(input.createAnyway).toBe(false)
    expect(input.quantity).toBe(200)
    expect(input.barcode).toBe("6281001234567")
  })

  it("returns duplicate candidates as 409", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist"))
    caps("pharmacist")
    createPurchaseCatalogProduct.mockResolvedValue({
      ok: false,
      code: "DUPLICATE_PRODUCT",
      error: "A similar product already exists.",
      candidates: [{ id: "cet", name: "Cetirizine 10 mg Tablet", score: 80 }],
    })
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Cetirizine 10 mg Tablet" }),
      }) as never,
    )
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe("DUPLICATE_PRODUCT")
    expect(json.candidates[0].id).toBe("cet")
  })

  it("creates with createAnyway for authorized staff", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist"))
    caps("pharmacist")
    createPurchaseCatalogProduct.mockResolvedValue({
      ok: true,
      duplicateOverride: true,
      product: {
        id: "cet-1",
        name: "Cetirizine 10 mg Tablet",
        sku: "CET-10",
        barcode: null,
        price: 0,
        costPrice: 0,
        genericName: "Cetirizine",
        strength: "10 mg",
        dosageForm: "Tablet",
        manufacturer: null,
      },
    })
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/purchases/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Cetirizine 10 mg Tablet", createAnyway: true, quantity: 200 }),
      }) as never,
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.product.id).toBe("cet-1")
    const input = createPurchaseCatalogProduct.mock.calls[0]?.[1]
    expect(input.tenantId).toBe("tenant-a")
    expect(input.createAnyway).toBe(true)
    expect(input.quantity).toBe(200)
  })
})
