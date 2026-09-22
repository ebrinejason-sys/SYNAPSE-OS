import { describe, expect, it, vi } from "vitest"

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        limit: async () => ({ data: [{ id: "t1" }], error: null }),
      }),
    }),
  },
}))

describe("health and ready probes", () => {
  it("live returns 200 without touching the database", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("no-store")
    const body = await res.json()
    expect(body.status).toBe("live")
    expect(body.checkedAt).toBeTruthy()
  })
})
