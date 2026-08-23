import { describe, expect, it } from "vitest"
import { __test__ } from "@/lib/pharmacy-context"
import type { PharmacyContext } from "@/lib/pharmacy-context"

function ctx(partial: Partial<PharmacyContext["session"]> & { storeId?: string | null }): PharmacyContext {
  return {
    ok: true,
    tenantId: "tenant-a",
    storeId: partial.storeId ?? null,
    session: {
      userId: "u1",
      email: "a@b.c",
      role: partial.role ?? "pharmacy_cashier",
      tenantId: "tenant-a",
      fullName: "A",
      firstName: "A",
      lastName: null,
      isAdmin: partial.isAdmin ?? false,
      tenantName: "A",
      tenantSlug: "a",
      tenantStatus: "active",
      modulesEnabled: [],
      mustChangePassword: false,
      permissions: [],
      pharmacyRole: partial.pharmacyRole ?? partial.role ?? "pharmacy_cashier",
      isImpersonation: false,
      impersonatorId: null,
      storeId: partial.storeId ?? null,
      profile: { tenant_id: "tenant-a", is_admin: Boolean(partial.isAdmin), full_name: "A", first_name: "A", last_name: null },
      user: { id: "u1", email: "a@b.c" },
      ...partial,
    },
  }
}

describe("requireStoreScope", () => {
  it("lets tenant-wide staff access any store", () => {
    const result = __test__.requireStoreScope(ctx({ storeId: null }), "store-2")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.storeId).toBe("store-2")
  })

  it("blocks a store-assigned cashier from another store", async () => {
    const result = __test__.requireStoreScope(ctx({ storeId: "store-1" }), "store-2")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
    expect(await result.response.json()).toMatchObject({ code: "STORE_SCOPE_DENIED" })
  })

  it("lets admins cross stores even when assigned", () => {
    const result = __test__.requireStoreScope(
      ctx({ storeId: "store-1", isAdmin: true, role: "pharmacy_admin", pharmacyRole: "pharmacy_admin" }),
      "store-2",
    )
    expect(result.ok).toBe(true)
  })

  it("denies A1 inventory officer submitting storeId=A2 for receive/adjust/ship/till", async () => {
    const a1 = ctx({
      storeId: "store-a1",
      role: "pharmacy_inventory",
      pharmacyRole: "pharmacy_inventory",
    })
    for (const attack of ["store-a2", "STORE_A2"]) {
      const result = __test__.requireStoreScope(a1, attack, { required: true })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.response.status).toBe(403)
      expect(await result.response.json()).toMatchObject({ code: "STORE_SCOPE_DENIED" })
    }
  })

  it("allows the assigned store and tenant-wide owner", () => {
    const a1 = ctx({ storeId: "store-a1", role: "pharmacy_inventory", pharmacyRole: "pharmacy_inventory" })
    const owner = ctx({ storeId: null, isAdmin: true, role: "pharmacy_admin", pharmacyRole: "pharmacy_admin" })
    expect(__test__.requireStoreScope(a1, "store-a1").ok).toBe(true)
    expect(__test__.requireStoreScope(owner, "store-a2").ok).toBe(true)
  })
})
