import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const m = vi.hoisted(() => ({ dbTouched: false }))
vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async () => ({ ok: true, session: { user: { id: "u" }, storeId: null }, tenantId: "t" })),
}))
vi.mock("@/lib/pharmacy-context", () => ({ requireStoreScope: () => ({ ok: true, storeId: null }) }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: new Proxy({}, { get: () => { m.dbTouched = true; throw new Error("db must not be touched") } }),
}))

describe("import apply guards client-supplied rows", () => {
  it("rejects more than 10k rows with 413 before touching the database", async () => {
    const { POST } = await import("./route")
    const rows = Array.from({ length: 10_001 }, () => ["A", "1"])
    const res = await POST({ json: async () => ({ allRows: rows }) } as any, { params: { id: "s" } } as any)
    expect(res.status).toBe(413)
    expect(m.dbTouched).toBe(false)
  })
  it("re-neutralises formula cells from the request body", () => {
    const src = readFileSync(join(__dirname, "route.ts"), "utf8")
    const guard = src.indexOf("neutralizeFormula(String(cell")
    const firstLoop = src.indexOf("for (let i = 0; i < body.allRows.length")
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(firstLoop)
  })
})
