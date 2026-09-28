import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  logHospitalAudit,
  persistWorkQueueArtifactsBestEffort,
  publishClinicalTimelineBestEffort,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  logHospitalAudit: vi.fn(),
  persistWorkQueueArtifactsBestEffort: vi.fn(),
  publishClinicalTimelineBestEffort: vi.fn(),
  dbFrom: vi.fn(),
}))

vi.mock("@/lib/hospital-dept", async () => {
  const { z } = await import("zod")
  return {
    requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
    triageSchema: z.object({
      patient_id: z.string().uuid(),
      chief_complaint: z.string().min(1),
      clinical_stage: z.enum(["RED", "YELLOW", "GREEN"]).optional(),
      heart_rate: z.number().optional(),
    }),
  }
})

vi.mock("@/lib/hospital-shared", async () => {
  const { NextResponse } = await import("next/server")
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> => value instanceof NextResponse,
    requireHospitalCapability: (...args: unknown[]) => requireHospitalCapability(...args),
    gateHospitalModule: (...args: unknown[]) => gateHospitalModule(...args),
    logHospitalAudit: (...args: unknown[]) => logHospitalAudit(...args),
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

vi.mock("@synapse/db/clinical-journey", () => ({
  recordEncounterOpened: () => ({
    correlationId: "corr-1",
    triageTask: { id: "task-1" },
    queue: { outbox: { list: () => [] } },
  }),
  recordTriageCompleted: () => ({ doctorTask: { id: "task-2" } }),
}))

vi.mock("@synapse/db/work-queue-persist", () => ({
  persistWorkQueueArtifactsBestEffort: (...args: unknown[]) => persistWorkQueueArtifactsBestEffort(...args),
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  encounterOpenedTimelineEvent: (input: unknown) => input,
  publishClinicalTimelineBestEffort: (...args: unknown[]) => publishClinicalTimelineBestEffort(...args),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(),
}))

vi.mock("@synapse/auth/mobile-push", () => ({
  notifyClinicalQueue: vi.fn(),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

function staffCtx(role: string) {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: `${role}@example.test`,
    role,
    tenantId: TENANT,
    hospitalId: HOSPITAL,
    facilityType: "hospital",
    fullName: role,
  }
}

function postBody(extra: Record<string, unknown> = { clinical_stage: "YELLOW" }) {
  return new NextRequest("https://synapseos.tech/api/opd/triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      patient_id: PATIENT,
      chief_complaint: "Fever",
      ...extra,
    }),
  })
}

function deny(resource: string, action: string) {
  return NextResponse.json({ error: "Forbidden", resource, action }, { status: 403 })
}

describe("POST /api/opd/triage authorization", () => {
  beforeEach(() => {
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    persistWorkQueueArtifactsBestEffort.mockResolvedValue({ errors: [] })
    publishClinicalTimelineBestEffort.mockResolvedValue(undefined)
    dbFrom.mockImplementation((table: string) => {
      if (table === "encounters") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: ENCOUNTER }, error: null }),
            }),
          }),
        }
      }
      return { insert: async () => ({ error: null }) }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("denies an unauthenticated caller before capability checks", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    requireHospitalStaffContext.mockResolvedValue(unauthorized)
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(401)
    expect(requireHospitalCapability).not.toHaveBeenCalled()
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("allows a nurse to open a visit with acuity when encounter.create and triage.assign are granted", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("nurse"))
    requireHospitalCapability.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(201)
    expect(requireHospitalCapability).toHaveBeenNthCalledWith(1, expect.objectContaining({ role: "nurse" }), "encounter", "create", "opd")
    expect(requireHospitalCapability).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: "nurse" }), "triage", "assign", "opd")
    expect(dbFrom).toHaveBeenCalledWith("encounters")
  })

  it("lets reception open a visit with a chief complaint only, without triage.assign", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("receptionist"))
    requireHospitalCapability.mockImplementation(async (_ctx, resource, action) => {
      if (resource === "triage" && action === "assign") return deny("triage", "assign")
      return null
    })
    const { POST } = await import("./route")
    const res = await POST(postBody({}))
    expect(res.status).toBe(201)
    expect(requireHospitalCapability.mock.calls).toHaveLength(1)
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "encounter", "create", "opd")
    expect(dbFrom).toHaveBeenCalledWith("encounters")
  })

  it("denies reception that sends acuity without triage.assign and writes nothing", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("receptionist"))
    requireHospitalCapability.mockImplementation(async (_ctx, resource, action) => {
      if (resource === "triage" && action === "assign") return deny("triage", "assign")
      return null
    })
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(403)
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "triage", "assign", "opd")
    expect(dbFrom).not.toHaveBeenCalled()
    expect(logHospitalAudit).not.toHaveBeenCalled()
  })

  it("denies reception that sends vitals without triage.assign", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("receptionist"))
    requireHospitalCapability.mockImplementation(async (_ctx, resource, action) => {
      if (resource === "triage" && action === "assign") return deny("triage", "assign")
      return null
    })
    const { POST } = await import("./route")
    const res = await POST(postBody({ heart_rate: 88 }))
    expect(res.status).toBe(403)
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("denies a role without encounter.create before parsing the body", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("cashier"))
    requireHospitalCapability.mockResolvedValue(deny("encounter", "create"))
    const { POST } = await import("./route")
    const res = await POST(postBody({}))
    expect(res.status).toBe(403)
    expect(requireHospitalCapability.mock.calls).toHaveLength(1)
    expect(gateHospitalModule).not.toHaveBeenCalled()
    expect(dbFrom).not.toHaveBeenCalled()
  })
})
