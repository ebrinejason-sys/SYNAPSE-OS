import { describe, expect, it } from "vitest"

describe("POST /api/demo/analyzer-simulate", () => {
  it("returns synthetic ASTM CBC parse/map/stage without production writes", async () => {
    const { POST } = await import("./route")
    const res = await POST(new Request("https://demo.synapseos.tech/api/demo/analyzer-simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panel: "fbc", accession: "DEMO-ACC-9" }),
    }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.isolated).toBe(true)
    expect(json.productionWrites).toBe(false)
    expect(json.staging.map((row: { analyzerCode: string }) => row.analyzerCode)).toEqual(["WBC", "HGB"])
    expect(json.staging[0].mappedLoinc).toBe("6690-2")
  })
})
