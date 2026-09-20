import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../../lib/rate-limit", () => ({
  rateLimiters: { demoAi: null },
  checkRateLimit: async () => ({ success: true, remaining: 99 }),
}))

describe("POST /api/demo/intelligence", () => {
  afterEach(() => {
    vi.resetModules()
  })

  it("returns a labeled synthetic recommendation and never imports supabaseAdmin", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./route.ts", import.meta.url), "utf8"))
    expect(source).not.toMatch(/supabaseAdmin|from\('encounters'\)|from\(\"encounters\"\)/)
    const { POST } = await import("./route")
    const res = await POST(new Request("https://demo.synapseos.tech/api/demo/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: "clinical_copilot",
        packet: {
          patientId: "demo-person-amina",
          tenantId: "demo-hospital",
          clinicianId: "doctor-demo",
          presentingComplaint: "Fever and headache",
          laboratory: [{ test: "WBC", value: "17.6", flag: "H" }],
        },
      }),
    }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.provider).toBe("synthetic-fallback")
    expect(json.isolated).toBe(true)
    expect(json.recommendation.provenance.model).toBe("synthetic-fallback")
  })

  it("rejects a caller-supplied production tenant and forbidden clinical authority actions", async () => {
    const { POST } = await import("./route")
    const tenant = await POST(new Request("https://demo.synapseos.tech/api/demo/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", task: "clinical_copilot" }),
    }) as never)
    expect(tenant.status).toBe(403)

    const forbidden = await POST(new Request("https://demo.synapseos.tech/api/demo/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ forbiddenAction: "release_lab_result", task: "lab_interpretation" }),
    }) as never)
    expect(forbidden.status).toBe(403)
  })
})
