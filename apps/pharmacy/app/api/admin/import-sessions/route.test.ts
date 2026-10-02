import { describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ inserts: [] as any[], cap: "" }))
vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: vi.fn(async (cap: string) => {
    m.cap = cap
    return { ok: true, session: { user: { id: "u-1" } }, tenantId: "tenant-1" }
  }),
}))
vi.mock("@synapse/db", () => ({ adapterFor: () => ({ analyse: () => ({ format: "csv", counts: {}, warnings: [] }) }) }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = {
        insert: (v: any) => (m.inserts.push(v), q),
        select: () => q,
        single: async () => ({ data: { id: "s-1" }, error: null }),
      }
      return q
    },
  },
}))

async function analyse(name: string, type: string, body: string) {
  const { POST } = await import("./route")
  const fd = new FormData()
  fd.append("file", new File([body], name, { type }))
  const req = { headers: new Headers({ "content-type": "multipart/form-data; boundary=x" }), formData: async () => fd }
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

describe("POST /api/admin/import-sessions hardening", () => {
  it("requires inventory.write", async () => {
    await analyse("t.csv", "text/csv", "name\nA\n")
    expect(m.cap).toBe("inventory.write")
  })
  it("rejects deeply nested JSON with 400 before parsing", async () => {
    m.inserts = []
    const r = await analyse("t.json", "application/json", "[".repeat(10000) + "]".repeat(10000))
    expect(r.status).toBe(400)
    expect(m.inserts).toEqual([])
  })
  it("rejects a wrong MIME with 415", async () => {
    const r = await analyse("t.json", "text/html", "[]")
    expect(r.status).toBe(415)
  })
  it("neutralises formula cells in the stored sample rows", async () => {
    m.inserts = []
    const r = await analyse("t.csv", "text/csv", "name,qty\n=cmd|' /C calc'!A0,-4\n")
    expect(r.status).toBe(201)
    expect(m.inserts[0].ai_mapping.sampleRows[0]).toEqual(["'=cmd|' /C calc'!A0", "-4"])
  })
})
