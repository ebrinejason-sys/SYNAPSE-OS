import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const {
  getCurrentUser,
  hasPlatformAdminAccess,
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  requireHospitalAudit,
  executeHospitalLabAction,
  getSimulationEngine,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPlatformAdminAccess: vi.fn(),
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  requireHospitalAudit: vi.fn(),
  executeHospitalLabAction: vi.fn(),
  getSimulationEngine: vi.fn(),
}))

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}))

vi.mock("@/lib/platform/auth", () => ({
  hasPlatformAdminAccess: (...args: unknown[]) => hasPlatformAdminAccess(...args),
}))

vi.mock("@/lib/hospital-dept", () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

vi.mock("@/lib/hospital-shared", async () => {
  const { NextResponse } = await import("next/server")
  class HospitalAuditRequiredError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "HospitalAuditRequiredError"
    }
  }
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> =>
      value instanceof NextResponse,
    requireHospitalCapability: (...args: unknown[]) => requireHospitalCapability(...args),
    gateHospitalModule: (...args: unknown[]) => gateHospitalModule(...args),
    requireHospitalAudit: (...args: unknown[]) => requireHospitalAudit(...args),
    HospitalAuditRequiredError,
  }
})

vi.mock("@/lib/hospital-lab-db", () => ({
  executeHospitalLabAction: (...args: unknown[]) => executeHospitalLabAction(...args),
}))

vi.mock("@/lib/platform/simulation-runtime", () => ({
  getSimulationEngine: (...args: unknown[]) => getSimulationEngine(...args),
}))

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const HOSPITAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ORDER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

function staff(role: string, tenantId = TENANT_A) {
  return {
    userId: USER,
    email: `${role}@example.test`,
    role,
    tenantId,
    hospitalId: HOSPITAL,
    facilityType: "hospital",
    fullName: role,
  }
}

describe("POST /api/lab/actions", () => {
  beforeEach(() => {
    hasPlatformAdminAccess.mockReturnValue(false)
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    requireHospitalAudit.mockResolvedValue(undefined)
    executeHospitalLabAction.mockResolvedValue({
      order: { id: ORDER, tenantId: TENANT_A, status: "COLLECTED" },
      result: null,
      warnings: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("rejects unauthenticated callers", async () => {
    getCurrentUser.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        body: JSON.stringify({ orderId: ORDER, action: "collect" }),
      }),
    )
    expect(res.status).toBe(401)
    expect(executeHospitalLabAction).not.toHaveBeenCalled()
  })

  it("blocks lab_tech from verify/release/amend", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_tech", email: "t@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_tech"))
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER, action: "verify" }),
      }),
    )
    expect(res.status).toBe(403)
    expect(executeHospitalLabAction).not.toHaveBeenCalled()
  })

  it("allows lab_scientist to release after capability check", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_scientist", email: "s@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_scientist"))
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER, action: "release" }),
      }),
    )
    expect(res.status).toBe(200)
    expect(requireHospitalCapability).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
      "result",
      "verify",
      "lab",
    )
    expect(executeHospitalLabAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "release",
        orderId: ORDER,
        actorId: USER,
        ctx: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    )
  })

  it("does not execute when staff context is for a different auth denial", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_scientist", email: "s@example.test" })
    requireHospitalStaffContext.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    )
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER, action: "collect" }),
      }),
    )
    expect(res.status).toBe(401)
    expect(executeHospitalLabAction).not.toHaveBeenCalled()
  })

  it("passes reject reason through to hospital lab action", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_tech", email: "t@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_tech"))
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: ORDER,
          action: "reject",
          reason: "hemolyzed",
          note: "Gross hemolysis",
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(executeHospitalLabAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reject",
        extra: expect.objectContaining({ reason: "hemolyzed", note: "Gross hemolysis" }),
      }),
    )
  })

  it("records tenant scope from authenticated context (not body tenantId)", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_scientist", email: "s@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_scientist", TENANT_A))
    const { POST } = await import("./route")
    await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: ORDER,
          action: "enter_result",
          value: "Negative",
          tenantId: TENANT_B,
        }),
      }),
    )
    expect(executeHospitalLabAction).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    )
  })
  it("requires durable audit before verify success", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_scientist", email: "s@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_scientist"))
    executeHospitalLabAction.mockResolvedValue({
      order: { id: ORDER, tenantId: TENANT_A, status: "VERIFIED" },
      result: { id: "result-1", status: "VERIFIED" },
      warnings: [],
    })
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER, action: "verify" }),
      }),
    )
    expect(res.status).toBe(200)
    expect(requireHospitalAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "LAB_RESULT_VERIFIED", recordId: ORDER }),
    )
  })

  it("refuses verify success when required audit fails (retry)", async () => {
    getCurrentUser.mockResolvedValue({ id: USER, role: "lab_scientist", email: "s@example.test" })
    requireHospitalStaffContext.mockResolvedValue(staff("lab_scientist"))
    const { HospitalAuditRequiredError } = await import("@/lib/hospital-shared")
    requireHospitalAudit.mockRejectedValue(new HospitalAuditRequiredError("audit insert failed"))
    const { POST } = await import("./route")
    const res = await POST(
      new Request("https://synapseos.tech/api/lab/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: ORDER, action: "verify" }),
      }),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe("AUDIT_REQUIRED_FAILED")
    expect(body.outcome).toBe("retry")
    expect(executeHospitalLabAction).toHaveBeenCalled()
  })

})
