import { afterEach, describe, expect, it, vi } from "vitest"

const { requirePlatformAdminApi, verifyStepUpMfa } = vi.hoisted(() => ({
  requirePlatformAdminApi: vi.fn(),
  verifyStepUpMfa: vi.fn(),
}))

vi.mock("@/lib/platform/auth", () => ({
  requirePlatformAdminApi: (...args: unknown[]) => requirePlatformAdminApi(...args),
}))
vi.mock("@synapse/auth", () => ({
  verifyStepUpMfa: (...args: unknown[]) => verifyStepUpMfa(...args),
}))

function makeRequest(body: Record<string, unknown>) {
  return new Request("https://synapseos.tech/api/platform/mfa/step-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/platform/mfa/step-up", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("denies unauthenticated callers before evaluating the code", async () => {
    const denied = new Response(JSON.stringify({ code: "PLATFORM_FORBIDDEN" }), { status: 403 })
    requirePlatformAdminApi.mockResolvedValue({ ok: false, response: denied })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ code: "123456" }))
    expect(res).toBe(denied)
    expect(verifyStepUpMfa).not.toHaveBeenCalled()
  })

  it("rejects a malformed code without calling verifyStepUpMfa", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1", sessionId: "session-1" } })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ code: "abc" }))
    expect(res.status).toBe(400)
    expect(verifyStepUpMfa).not.toHaveBeenCalled()
  })

  it("returns 401 for an incorrect code", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1", sessionId: "session-1" } })
    verifyStepUpMfa.mockResolvedValue({ ok: false, code: "INVALID_CODE" })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ code: "111111" }))
    expect(res.status).toBe(401)
    expect(verifyStepUpMfa).toHaveBeenCalledWith("admin-1", "session-1", "111111")
  })

  it("returns 409 when the admin has no verified enrollment", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1", sessionId: "session-1" } })
    verifyStepUpMfa.mockResolvedValue({ ok: false, code: "NOT_ENROLLED" })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ code: "111111" }))
    expect(res.status).toBe(409)
  })

  it("succeeds for a correct code", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1", sessionId: "session-1" } })
    verifyStepUpMfa.mockResolvedValue({ ok: true })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ code: "111111" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
