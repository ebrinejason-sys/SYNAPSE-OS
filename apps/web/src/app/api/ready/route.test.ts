import { beforeEach, describe, expect, it, vi } from "vitest"

const { selectLimit } = vi.hoisted(() => ({
  selectLimit: vi.fn(async () => ({ data: [{ id: "t1" }], error: null })),
}))

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        limit: (...args: unknown[]) => selectLimit(...args),
      }),
    }),
  },
}))

vi.mock("@/lib/platform/sha-alignment", () => ({
  repoMigrationHeadFromFiles: () => "20260921120000",
}))

vi.mock("@synapse/interop", () => ({
  whoApiConfigured: () => false,
}))

vi.mock("@/lib/ai/openrouter", () => ({
  isOpenRouterConfigured: () => false,
}))

describe("ready probe", () => {
  beforeEach(() => {
    selectLimit.mockClear()
    selectLimit.mockResolvedValue({ data: [{ id: "t1" }], error: null })
  })

  it("returns 200 when the database probe succeeds", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("no-store")
    const body = await res.json()
    expect(body.status).toBe("ready")
    expect(body.checks.database.ok).toBe(true)
  })

  it("returns 503 when the database probe fails", async () => {
    selectLimit.mockResolvedValueOnce({ data: null, error: { message: "down" } })
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe("not_ready")
  })
})
