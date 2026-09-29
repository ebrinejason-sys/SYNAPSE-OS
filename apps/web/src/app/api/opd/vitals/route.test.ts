import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  logHospitalAudit,
  persistWorkQueueArtifactsBestEffort,
  recordTriageCompleted,
  encounterUpdate,
  triageTaskRow,
  encounterHospital,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  logHospitalAudit: vi.fn(),
  persistWorkQueueArtifactsBestEffort: vi.fn(),
  recordTriageCompleted: vi.fn(),
  encounterUpdate: vi.fn(),
  triageTaskRow: { current: null as Record<string, unknown> | null },
  encounterHospital: { current: "" },
}))

vi.mock("@/lib/hospital-dept", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/hospital-dept/schemas")>(
    "../../../../lib/hospital-dept/schemas",
  )
  return {
    requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
    vitalsRecordSchema: actual.vitalsRecordSchema,
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

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

function chain(result: unknown) {
  const node: Record<string, unknown> = {}
  for (const method of ["select", "eq", "in", "limit"]) node[method] = () => node
  node.maybeSingle = async () => result
  node.single = async () => result
  return node
}

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "encounters") {
        const filters: Record<string, unknown> = {}
        const row = { id: ENCOUNTER, patient_id: PATIENT, is_signed: false, hospital_id: encounterHospital.current }
        const node = chain(null)
        node.eq = (column: string, value: unknown) => { filters[column] = value; return node }
        node.maybeSingle = async () => ({ data: Object.entries(filters).every(([k, v]) => !(k in row) || row[k as keyof typeof row] === v) ? row : null, error: null })
        return {
          ...node,
          update: (patch: unknown) => {
            encounterUpdate(patch)
            return { eq: () => ({ eq: async () => ({ error: null }) }) }
          },
        }
      }
      if (table === "vitals") return { insert: () => chain({ data: { id: "vitals-1" }, error: null }) }
      if (table === "department_tasks") return chain({ data: triageTaskRow.current, error: null })
      throw new Error(`unexpected table ${table}`)
    },
  },
}))

vi.mock("@synapse/db/clinical-journey", () => ({
  recordTriageCompleted: (...args: unknown[]) => recordTriageCompleted(...args),
}))

vi.mock("@synapse/db/work-queue-persist", () => ({
  rowToDepartmentTask: (row: Record<string, unknown>) => ({ id: row.id, tenantId: row.tenant_id, status: row.status }),
  persistWorkQueueArtifactsBestEffort: (...args: unknown[]) => persistWorkQueueArtifactsBestEffort(...args),
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  clinicalActionTimelineEvent: (input: unknown) => input,
  publishClinicalTimelineBestEffort: vi.fn(),
}))

vi.mock("@synapse/db/identity-persist", () => ({ publishTimelineEvent: vi.fn() }))

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

function postBody(extra: Record<string, unknown> = {}) {
  return new NextRequest("https://synapseos.tech/api/opd/vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ encounter_id: ENCOUNTER, patient_id: PATIENT, heart_rate: 90, ...extra }),
  })
}

describe("POST /api/opd/vitals", () => {
  beforeEach(() => {
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    persistWorkQueueArtifactsBestEffort.mockResolvedValue({ errors: [] })
    recordTriageCompleted.mockReturnValue({ doctorTask: { id: "doctor-task" } })
    triageTaskRow.current = null
    encounterHospital.current = HOSPITAL
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("denies reception without triage.assign", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("receptionist"))
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const { POST } = await import("./route")
    const res = await POST(postBody({ clinical_stage: "RED" }))
    expect(res.status).toBe(403)
    expect(encounterUpdate).not.toHaveBeenCalled()
    expect(logHospitalAudit).not.toHaveBeenCalled()
  })

  it("lets a nurse set acuity on an existing visit without writing it into vitals", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("nurse"))
    requireHospitalCapability.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(postBody({ clinical_stage: "YELLOW" }))
    expect(res.status).toBe(201)
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "triage", "assign", "opd")
    expect(encounterUpdate).toHaveBeenCalledWith({ clinical_stage: "YELLOW" })
  })

  it("hands an open triage task to doctor review", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("nurse"))
    requireHospitalCapability.mockResolvedValue(null)
    triageTaskRow.current = { id: "triage-task", tenant_id: TENANT, status: "REQUESTED" }
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(201)
    expect(recordTriageCompleted).toHaveBeenCalledWith(expect.objectContaining({ triageTaskId: "triage-task", encounterId: ENCOUNTER }))
    expect(persistWorkQueueArtifactsBestEffort).toHaveBeenCalledTimes(1)
  })

  it("does not create another doctor task when triage is already complete", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("nurse"))
    requireHospitalCapability.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(201)
    expect(recordTriageCompleted).not.toHaveBeenCalled()
    expect(encounterUpdate).not.toHaveBeenCalled()
  })

  it("hides encounters from another hospital in the same tenant", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("nurse"))
    requireHospitalCapability.mockResolvedValue(null)
    encounterHospital.current = "99999999-9999-4999-8999-999999999999"
    const { POST } = await import("./route")
    const res = await POST(postBody())
    expect(res.status).toBe(404)
    expect(logHospitalAudit).not.toHaveBeenCalled()
  })
})
