import { beforeEach, describe, expect, it, vi } from "vitest"

// A tenant-scoped UPDATE that matches no row (foreign or unknown id) must be a 404,
// not a 500 from PostgREST's .single() "0 rows" error.
const auth = {
  ok: true as const,
  tenantId: "tenant-A",
  session: { user: { id: "user-A" }, userId: "user-A", tenantId: "tenant-A" },
}
vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async () => auth),
  requirePharmacyTenant: vi.fn(async () => auth),
}))
vi.mock("@synapse/db/identity-persist", () => ({ registerPersonForFacility: vi.fn() }))

const filters: Array<[string, unknown]> = []
const auditInsert = vi.fn(async () => ({ error: null }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "pharmacy_audit_logs") return { insert: auditInsert }
      const q: any = {
        update: () => q,
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push([k, v]), q),
        neq: () => q,
        single: async () => ({ data: null, error: { code: "PGRST116", message: "The result contains 0 rows" } }),
        maybeSingle: async () => ({ data: null, error: null }),
      }
      return q
    },
  },
}))

import { PATCH as patchSupplier } from "./suppliers/route"
import { PATCH as patchCustomer } from "./customers/route"

const req = (body: unknown) =>
  new Request("http://pharm.test/api", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as any

describe("foreign ids on tenant-scoped PATCH", () => {
  beforeEach(() => { filters.length = 0; auditInsert.mockClear() })

  it("supplier PATCH with another tenant's id returns 404 and writes no audit row", async () => {
    const res = await patchSupplier(req({ id: "supplier-of-B", name: "pwned", email: "x@example.test" }))
    expect(res.status).toBe(404)
    expect(filters).toContainEqual(["tenant_id", "tenant-A"])
    expect(auditInsert).not.toHaveBeenCalled()
  })

  it("customer PATCH with another tenant's id returns 404 and writes no audit row", async () => {
    const res = await patchCustomer(req({ id: "customer-of-B", name: "pwned" }))
    expect(res.status).toBe(404)
    expect(filters).toContainEqual(["tenant_id", "tenant-A"])
    expect(auditInsert).not.toHaveBeenCalled()
  })
})
