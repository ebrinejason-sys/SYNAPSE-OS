import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import type { PharmacySession } from "@/lib/auth"

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    ...actual,
    getPharmacySession: vi.fn(),
  }
})

import { getPharmacySession } from "@/lib/auth"
import {
  requirePharmacyApiSession,
  requirePharmacyTenant,
  requirePharmacyAdmin,
  requirePharmacyPermission,
  requirePlatformAdmin,
  assertResourceTenant,
  getTrustedRequestTenantId,
  __test__,
} from "@/lib/api-auth"

const getSession = getPharmacySession as unknown as ReturnType<typeof vi.fn>

function session(partial: Partial<PharmacySession> & Pick<PharmacySession, "role" | "tenantId">): PharmacySession {
  return {
    userId: "user-1",
    email: "a@b.c",
    fullName: "A",
    firstName: "A",
    lastName: null,
    isAdmin: partial.role === "pharmacy_admin" || partial.isAdmin === true,
    tenantName: "Care Plus",
    tenantSlug: "care-plus",
    tenantStatus: "active",
    modulesEnabled: [],
    mustChangePassword: false,
    permissions: [],
    pharmacyRole: partial.pharmacyRole ?? partial.role,
    isImpersonation: false,
    impersonatorId: null,
    storeId: partial.storeId ?? null,
    profile: {
      tenant_id: partial.tenantId,
      is_admin: partial.role === "pharmacy_admin" || partial.isAdmin === true,
      full_name: "A",
      first_name: "A",
      last_name: null,
    },
    user: { id: "user-1", email: "a@b.c" },
    ...partial,
  }
}

beforeEach(() => {
  getSession.mockReset()
})

describe("requirePharmacyApiSession", () => {
  it("returns 401 when there is no session", async () => {
    getSession.mockResolvedValue(null)
    const result = await requirePharmacyApiSession()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(401)
  })

  it("returns the session when present", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_cashier", tenantId: "t1" }))
    const result = await requirePharmacyApiSession()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.tenantId).toBe("t1")
  })
})

describe("requirePharmacyTenant", () => {
  it("rejects sessions without a tenant id", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_cashier", tenantId: "" }))
    const result = await requirePharmacyTenant()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
  })

  it("exposes tenantId only from the session (never client input)", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_cashier", tenantId: "tenant-session" }))
    const result = await requirePharmacyTenant()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tenantId).toBe("tenant-session")
  })
})

describe("requirePharmacyAdmin", () => {
  it("forbids cashiers", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_cashier", tenantId: "t1", isAdmin: false }))
    const result = await requirePharmacyAdmin()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
  })

  it("allows pharmacy_admin", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_admin", tenantId: "t1" }))
    const result = await requirePharmacyAdmin()
    expect(result.ok).toBe(true)
  })
})

describe("requirePharmacyPermission", () => {
  it("allows cashiers to sell", async () => {
    getSession.mockResolvedValue(
      session({ role: "pharmacy_cashier", tenantId: "t1", isAdmin: false, pharmacyRole: "pharmacy_cashier" }),
    )
    const result = await requirePharmacyPermission("pos.sell")
    expect(result.ok).toBe(true)
  })

  it("forbids cashiers from adjusting inventory", async () => {
    getSession.mockResolvedValue(
      session({ role: "pharmacy_cashier", tenantId: "t1", isAdmin: false, pharmacyRole: "pharmacy_cashier" }),
    )
    const result = await requirePharmacyPermission("inventory.adjust")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
  })

  it("allows inventory officers to adjust stock", async () => {
    getSession.mockResolvedValue(
      session({
        role: "inventory_officer",
        tenantId: "t1",
        isAdmin: false,
        pharmacyRole: "inventory_officer",
      }),
    )
    const result = await requirePharmacyPermission("inventory.adjust")
    expect(result.ok).toBe(true)
  })

  it("accepts legacy MANAGE_POS grant", async () => {
    getSession.mockResolvedValue(
      session({
        role: "pharmacy_staff",
        tenantId: "t1",
        isAdmin: false,
        pharmacyRole: "pharmacy_staff",
        permissions: ["MANAGE_POS"],
      }),
    )
    // pharmacy_staff aliases to cashier which already has pos.sell; use a role with no defaults
    getSession.mockResolvedValue(
      session({
        role: "custom",
        tenantId: "t1",
        isAdmin: false,
        pharmacyRole: "custom",
        permissions: ["MANAGE_POS"],
      }),
    )
    const result = await requirePharmacyPermission("pos.sell")
    expect(result.ok).toBe(true)
  })
})

describe("requirePlatformAdmin", () => {
  it("forbids tenant pharmacy admins", async () => {
    getSession.mockResolvedValue(session({ role: "pharmacy_admin", tenantId: "t1" }))
    const result = await requirePlatformAdmin()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
  })

  it("allows platform_admin", async () => {
    getSession.mockResolvedValue(session({ role: "platform_admin", tenantId: "", isAdmin: true }))
    const result = await requirePlatformAdmin()
    expect(result.ok).toBe(true)
  })
})

describe("tenant isolation helpers", () => {
  it("assertResourceTenant hides cross-tenant rows as 404", () => {
    const miss = assertResourceTenant("tenant-a", "tenant-b")
    expect(miss.ok).toBe(false)
    if (miss.ok) return
    expect(miss.response.status).toBe(404)

    const hit = assertResourceTenant("tenant-a", "tenant-a")
    expect(hit.ok).toBe(true)
  })

  it("getTrustedRequestTenantId prefers middleware x-tenant-id over query", () => {
    const req = {
      headers: new Headers({ "x-tenant-id": "from-domain" }),
    } as unknown as import("next/server").NextRequest
    expect(getTrustedRequestTenantId(req, "from-query")).toBe("from-domain")
    expect(getTrustedRequestTenantId(req)).toBe("from-domain")

    const bare = {
      headers: new Headers(),
    } as unknown as import("next/server").NextRequest
    expect(getTrustedRequestTenantId(bare, "from-query")).toBe("from-query")
    expect(getTrustedRequestTenantId(bare)).toBe(null)
  })

  it("resolveTenantId never invents a tenant from outside the session", () => {
    expect(
      __test__.resolveTenantId({
        tenantId: "sess",
        profile: { tenant_id: "sess", is_admin: false, full_name: null, first_name: null, last_name: null },
      }),
    ).toBe("sess")
  })
})

describe("response helpers", () => {
  it("returns JSON NextResponses", async () => {
    getSession.mockResolvedValue(null)
    const result = await requirePharmacyApiSession()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response).toBeInstanceOf(NextResponse)
  })
})
