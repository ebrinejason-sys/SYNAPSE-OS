import { afterEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const {
  requirePlatformAdminApi,
  createFacilityInvitation,
  markFacilityInvitationSent,
  markFacilityInvitationDeliveryFailed,
  sendHospitalStaffInviteEmail,
  dbFrom,
} = vi.hoisted(() => ({
  requirePlatformAdminApi: vi.fn(),
  createFacilityInvitation: vi.fn(),
  markFacilityInvitationSent: vi.fn(),
  markFacilityInvitationDeliveryFailed: vi.fn(),
  sendHospitalStaffInviteEmail: vi.fn(),
  dbFrom: vi.fn(),
}))

vi.mock("@/lib/platform/auth", () => ({
  requirePlatformAdminApi: (...args: unknown[]) => requirePlatformAdminApi(...args),
}))

vi.mock("@/lib/platform/facility-invitations.server", () => ({
  createFacilityInvitation: (...args: unknown[]) => createFacilityInvitation(...args),
  markFacilityInvitationSent: (...args: unknown[]) => markFacilityInvitationSent(...args),
  markFacilityInvitationDeliveryFailed: (...args: unknown[]) => markFacilityInvitationDeliveryFailed(...args),
}))

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

vi.mock("@synapse/db/facility-provision", () => ({
  facilityInviteUrl: () => "https://pilot-lab.synapseos.tech/invite/facility/tok",
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
    vi.resetModules()
  })

  it("denies unauthorized callers before creating invitations", async () => {
    const denied = NextResponse.json({ code: "PLATFORM_FORBIDDEN" }, { status: 403 })
    requirePlatformAdminApi.mockResolvedValue({ ok: false, response: denied })

    const { POST } = await import("./route")
    const res = await POST(makeRequest(), { params })

    expect(requirePlatformAdminApi).toHaveBeenCalledWith("user.invite")
    expect(res).toBe(denied)
    expect(createFacilityInvitation).not.toHaveBeenCalled()
    expect(sendHospitalStaffInviteEmail).not.toHaveBeenCalled()
  })

  it("creates a hardened invitation and emails the setup link", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1" } })
    createFacilityInvitation.mockResolvedValue({
      ok: true,
      invitationId: "inv-1",
      token: "raw-token",
      expiresAt: "2026-09-18T00:00:00.000Z",
      email: "new-staff@example.test",
      tenantName: "Pilot Lab",
    })
    dbFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { slug: "pilot-lab", facility_type: "laboratory" } }),
        }),
      }),
    })
    sendHospitalStaffInviteEmail.mockResolvedValue(undefined)
    markFacilityInvitationSent.mockResolvedValue(undefined)

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest({ email: "new-staff@example.test", fullName: "New Staff", role: "lab_tech", departmentId: "" }),
      { params },
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.invitationId).toBe("inv-1")
    expect(json.inviteUrl).toContain("/invite/facility/")
    expect(createFacilityInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        email: "new-staff@example.test",
        fullName: "New Staff",
        role: "lab_tech",
        departmentId: null,
        actorId: "admin-1",
      }),
    )
    expect(sendHospitalStaffInviteEmail).toHaveBeenCalled()
    expect(markFacilityInvitationSent).toHaveBeenCalledWith("inv-1")
  })

  it("surfaces schema incompatibility from the create helper as 503", async () => {
    requirePlatformAdminApi.mockResolvedValue({ ok: true, profile: { id: "admin-1" } })
    createFacilityInvitation.mockResolvedValue({
      ok: false,
      status: 503,
      code: "SCHEMA_INCOMPATIBLE",
      error: "facility_invitations is missing the token_hash/redeemed_by columns required by the hardened invitation flow",
    })

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ email: "new-staff@example.test", fullName: "New Staff", role: "lab_tech" }), { params })

    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.code).toBe("SCHEMA_INCOMPATIBLE")
    expect(sendHospitalStaffInviteEmail).not.toHaveBeenCalled()
  })
})
