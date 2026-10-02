import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ settings: null as Record<string, unknown> | null }))

const ctx = {
  user: { id: "staff-1", email: "s@example.test", role: "pharmacy_cashier", tenantId: "t1", isAdmin: false, fullName: null, firstName: null, lastName: null, mustChangePassword: false },
  tenant: { facilityType: "pharmacy", name: "T", slug: "t", status: "active", modulesEnabled: [] },
  isImpersonation: false,
  impersonatorId: null,
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`)
  },
}))
vi.mock("@synapse/auth/context", () => ({
  getContextSafe: vi.fn(async () => ctx),
  getContext: vi.fn(async () => ctx),
}))
vi.mock("@synapse/db/admin", () => {
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: m.settings, error: null }) }
  return { supabaseAdmin: { from: () => q } }
})

import { getPharmacySession, requirePharmacySession } from "./auth"

describe("pharmacy session gate — deactivated staff", () => {
  beforeEach(() => {
    m.settings = null
  })

  it("an existing session of a deactivated user resolves to no session (APIs answer 401)", async () => {
    m.settings = { pharmacy_role: "pharmacy_cashier", permissions: ["pos.sell"], is_active: false }
    expect(await getPharmacySession()).toBeNull()
  })

  it("pages redirect a deactivated user to login", async () => {
    m.settings = { is_active: false }
    await expect(requirePharmacySession()).rejects.toThrow("REDIRECT:/login?error=account_inactive")
  })

  it("reactivation restores the session; users without a settings row stay active", async () => {
    m.settings = { pharmacy_role: "pharmacy_cashier", permissions: ["pos.sell"], is_active: true }
    expect((await getPharmacySession())?.userId).toBe("staff-1")
    m.settings = null
    expect((await getPharmacySession())?.userId).toBe("staff-1")
  })
})
