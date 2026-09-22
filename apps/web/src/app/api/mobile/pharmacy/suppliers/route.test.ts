import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const { requireMobilePharmacyAuth, isMobileAuth, mobileHasPharmacyCapability } = vi.hoisted(() => ({
  requireMobilePharmacyAuth: vi.fn(),
  isMobileAuth: vi.fn(),
  mobileHasPharmacyCapability: vi.fn(),
}))

vi.mock("../../../../../lib/mobile-pharmacy-auth", () => ({
  requireMobilePharmacyAuth: (...args: unknown[]) => requireMobilePharmacyAuth(...args),
  isMobileAuth: (...args: unknown[]) => isMobileAuth(...args),
  mobileHasPharmacyCapability: (...args: unknown[]) => mobileHasPharmacyCapability(...args),
}))

const { insert, eqCalls } = vi.hoisted(() => ({
  insert: vi.fn(),
  eqCalls: [] as Array<[string, string]>,
}))

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => {
      const api: Record<string, unknown> = {}
      const self = () => api
      api.select = self
      api.eq = (...args: [string, string]) => {
        eqCalls.push(args)
        return api
      }
      api.order = async () => ({
        data: eqCalls.some(([col, val]) => col === "tenant_id" && val === "tenant-a")
          ? [{ id: "s1", name: "Supplier A", tenant_id: "tenant-a" }]
          : [],
        error: null,
      })
      api.maybeSingle = async () => ({ data: null, error: null })
      api.insert = (...args: unknown[]) => {
        insert(...args)
        return api
      }
      api.single = async () => ({ data: { id: "s-new", name: "Supplier A", tenant_id: "tenant-a" }, error: null })
      return api
    },
  },
}))

import { GET, POST } from "./route"

function auth(role: string, tenantId = "tenant-a") {
  return { userId: "user-1", tenantId, role, token: "t" }
}

describe("mobile pharmacy suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqCalls.length = 0
    isMobileAuth.mockImplementation(
      (value: unknown) =>
        Boolean(value) && typeof value === "object" && !(value instanceof NextResponse) && "tenantId" in (value as object),
    )
  })

  it("lets a purchasing user create a supplier in their tenant", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist"))
    mobileHasPharmacyCapability.mockImplementation((_a: unknown, cap: string) => cap === "purchasing.manage")
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/suppliers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Supplier A", tenant_id: "tenant-b" }),
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalled()
    expect(insert.mock.calls[0]?.[0]?.tenant_id).toBe("tenant-a")
    expect(insert.mock.calls.some((call) => call[0]?.action === "CREATE_SUPPLIER")).toBe(true)
  })

  it("denies cashier supplier create", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacy_cashier"))
    mobileHasPharmacyCapability.mockReturnValue(false)
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/suppliers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Supplier A" }),
      }) as never,
    )
    expect(res.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
  })

  it("denies unauthenticated supplier create", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    isMobileAuth.mockReturnValue(false)
    const res = await POST(
      new Request("https://app.test/api/mobile/pharmacy/suppliers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Supplier A" }),
      }) as never,
    )
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("lists only the authenticated tenant suppliers", async () => {
    requireMobilePharmacyAuth.mockResolvedValue(auth("pharmacist", "tenant-a"))
    mobileHasPharmacyCapability.mockReturnValue(true)
    const res = await GET(new Request("https://app.test/api/mobile/pharmacy/suppliers") as never)
    expect(res.status).toBe(200)
    expect(eqCalls.some(([col, val]) => col === "tenant_id" && val === "tenant-a")).toBe(true)
    expect(eqCalls.some(([, val]) => val === "tenant-b")).toBe(false)
  })
})
