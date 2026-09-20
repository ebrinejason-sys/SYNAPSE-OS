import { describe, expect, it } from "vitest"
import { GET } from "./route"

describe("GET /api/demo/ready", () => {
  it("reports a synthetic playground that does not write production healthcare state", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./route.ts", import.meta.url), "utf8"))
    expect(source).not.toMatch(/supabaseAdmin|SUPABASE_SERVICE_ROLE/)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("ready")
    expect(json.mode).toBe("synthetic-playground")
    expect(json.productionWrites).toBe(false)
  })
})
