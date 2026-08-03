import { describe, expect, it } from "vitest"
import { POST, GET } from "./route"

describe("legacy POS transaction route", () => {
  it("returns 410 Gone on POST", async () => {
    const res = await POST(new Request("https://pharm.test/api/admin/pos/transaction", { method: "POST" }) as any)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe("POS_LEGACY_RETIRED")
    expect(body.successor).toBe("/api/admin/pos/complete-sale")
  })

  it("returns 410 Gone on GET", async () => {
    const res = await GET()
    expect(res.status).toBe(410)
  })
})
