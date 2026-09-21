import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const { requireHospitalStaffContext, gateHospitalModule } = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  gateHospitalModule: vi.fn(),
}))

vi.mock("@/lib/hospital-dept", () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

vi.mock("@/lib/hospital-shared", async () => {
  const { NextResponse } = await import("next/server")
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> => value instanceof NextResponse,
    gateHospitalModule: (...args: unknown[]) => gateHospitalModule(...args),
    requireHospitalCapability: vi.fn(async () => null),
  }
})

describe("pathway copilot safety", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("forbids AI death and pathway execution actions", async () => {
    requireHospitalStaffContext.mockResolvedValue({
      userId: "55555555-5555-4555-8555-555555555555",
      role: "doctor",
      tenantId: "11111111-1111-4111-8111-111111111111",
      hospitalId: "11111111-1111-4111-8111-111111111111",
      facilityType: "hospital",
    })
    gateHospitalModule.mockResolvedValue(null)
    const { POST } = await import("./route")
    for (const forbiddenAction of ["pronounce_death", "certify_death", "release_body", "activate_pathway", "place_order"]) {
      const res = await POST(new NextRequest("https://synapseos.tech/api/clinical/intelligence/pathway", {
        method: "POST",
        body: JSON.stringify({
          forbiddenAction,
          packet: {
            patientId: "p1",
            tenantId: "11111111-1111-4111-8111-111111111111",
            clinicianId: "c1",
            presentingComplaint: "fever",
          },
        }),
        headers: { "content-type": "application/json" },
      }))
      expect(res.status, forbiddenAction).toBe(403)
    }
  })
})
