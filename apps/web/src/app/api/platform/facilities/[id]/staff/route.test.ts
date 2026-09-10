import { afterEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const { requirePlatformAdminApi, dbFrom, sendHospitalStaffInviteEmail, hashPassword } = vi.hoisted(() => ({
  requirePlatformAdminApi: vi.fn(),
  dbFrom: vi.fn(),
  sendHospitalStaffInviteEmail: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock("@/lib/platform/auth", () => ({
  requirePlatformAdminApi: (...args: unknown[]) => requirePlatformAdminApi(...args),
}))

// Guards: if the disabled legacy implementation is ever reachable again, these
// spies make the regression fail instead of silently mutating data.
vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))
vi.mock("@synapse/auth", () => ({
  hashPassword: (...args: unknown[]) => hashPassword(...args),
}))
vi.mock("@/lib/resend", () => ({
  sendHospitalStaffInviteEmail: (...args: unknown[]) => sendHospitalStaffInviteEmail(...args),
}))

const params = Promise.resolve({ id: "tenant-1" })

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request("https://synapseos.tech/api/platform/facilities/tenant-1/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/platform/facilities/[id]/staff", () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.FACILITY_INVITE_HARDENED
  })

  it("denies unauthorized callers before evaluating the hardening flag", async () => {
    const denied = NextResponse.json({ code: "PLATFORM_FORBIDDEN" }, { status: 403 })
    requirePlatformAdminApi.mockResolvedValue({ ok: false, response: denied })

    const { POST } = await import("./route")
    const res = await POST(makeRequest(), { params })

    expect(requirePlatformAdminApi).toHaveBeenCalledWith("user.invite")
    expect(res).toBe(denied)
    expect(res.status).toBe(403)
    expect(dbFrom).not.toHaveBeenCalled()
    expect(sendHospitalStaffInviteEmail).not.toHaveBeenCalled()
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it.each([undefined, "false", "true", "TRUE", "1"])(
    "returns the documented 503 for authorized callers regardless of FACILITY_INVITE_HARDENED=%s",
    async (flagValue) => {
      if (flagValue === undefined) delete process.env.FACILITY_INVITE_HARDENED
      else process.env.FACILITY_INVITE_HARDENED = flagValue

      requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1" } })

      const { POST } = await import("./route")
      const res = await POST(makeRequest({ email: "new-staff@example.test", fullName: "New Staff", role: "lab_tech" }), { params })

      expect(res.status).toBe(503)
      const json = await res.json()
      expect(json.code).toBe("FACILITY_INVITE_HARDENING_REQUIRED")

      expect(dbFrom).not.toHaveBeenCalled()
      expect(sendHospitalStaffInviteEmail).not.toHaveBeenCalled()
      expect(hashPassword).not.toHaveBeenCalled()
    },
  )
})
