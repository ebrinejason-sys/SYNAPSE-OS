import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const { requireHospitalStaffContext, requireHospitalCapability, gateHospitalModule, logHospitalAudit, findDuplicatePatients, patientInsert } =
  vi.hoisted(() => ({
    requireHospitalStaffContext: vi.fn(),
    requireHospitalCapability: vi.fn(),
    gateHospitalModule: vi.fn(),
    logHospitalAudit: vi.fn(),
    findDuplicatePatients: vi.fn(),
    patientInsert: vi.fn(),
  }))

vi.mock("../../../../lib/hospital-dept", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/hospital-dept/schemas")>(
    "../../../../lib/hospital-dept/schemas",
  )
  return {
    requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
    patientRegisterSchema: actual.patientRegisterSchema,
  }
})

vi.mock("../../../../lib/hospital-dept/patient-duplicates", () => ({
  findDuplicatePatients: (...args: unknown[]) => findDuplicatePatients(...args),
}))

vi.mock("../../../../lib/hospital-shared", async () => {
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
const NEW_PATIENT = { id: "new-patient", mrn: "MRN-NEW", full_name: "Amina Nakato", dob: "1990-01-01", sex: "F" }
const EXISTING = { id: "existing-patient", mrn: "MRN-OLD", full_name: "Amina Nakato", dob: "1990-01-01", sex: "F", phone: "0700", nin: null }

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: (row: unknown) => {
        patientInsert(row)
        return { select: () => ({ single: async () => ({ data: NEW_PATIENT, error: null }) }) }
      },
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}))

vi.mock("@synapse/db/identity-persist", () => ({
  registerPersonForFacility: async () => null,
}))

function post(body: Record<string, unknown>) {
  return new NextRequest("https://synapseos.tech/api/patients/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ full_name: "Amina Nakato", sex: "F", dob: "1990-01-01", ...body }),
  })
}

describe("POST /api/patients/register duplicate handling", () => {
  beforeEach(() => {
    requireHospitalStaffContext.mockResolvedValue({
      userId: "55555555-5555-4555-8555-555555555555",
      role: "receptionist",
      tenantId: TENANT,
      hospitalId: HOSPITAL,
      facilityType: "hospital",
    })
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("registers when no likely duplicate exists", async () => {
    findDuplicatePatients.mockResolvedValue([])
    const { POST } = await import("./route")
    const res = await POST(post({}))
    expect(res.status).toBe(201)
    expect(findDuplicatePatients).toHaveBeenCalledWith(expect.anything(), TENANT, expect.objectContaining({ full_name: "Amina Nakato" }))
    expect(logHospitalAudit).toHaveBeenCalledWith(expect.objectContaining({ newValue: NEW_PATIENT }))
  })

  it("warns with candidates and writes nothing when a likely duplicate exists", async () => {
    findDuplicatePatients.mockResolvedValue([EXISTING])
    const { POST } = await import("./route")
    const res = await POST(post({}))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("POSSIBLE_DUPLICATE")
    expect(body.candidates).toEqual([{ id: "existing-patient", mrn: "MRN-OLD", full_name: "Amina Nakato", dob: "1990-01-01", sex: "F" }])
    expect(body.candidates[0]).not.toHaveProperty("phone")
    expect(patientInsert).not.toHaveBeenCalled()
    expect(logHospitalAudit).not.toHaveBeenCalled()
  })

  it("creates anyway with a reason and records the override in the audit row", async () => {
    findDuplicatePatients.mockResolvedValue([EXISTING])
    const { POST } = await import("./route")
    const res = await POST(post({ duplicate_override_reason: "Different person, same name" }))
    expect(res.status).toBe(201)
    expect(patientInsert).toHaveBeenCalledWith(expect.not.objectContaining({ duplicate_override_reason: expect.anything() }))
    expect(logHospitalAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "patients",
        newValue: expect.objectContaining({
          duplicate_override: { reason: "Different person, same name", candidate_patient_ids: ["existing-patient"] },
        }),
      }),
    )
  })

  it("rejects an override reason that is too short", async () => {
    findDuplicatePatients.mockResolvedValue([EXISTING])
    const { POST } = await import("./route")
    const res = await POST(post({ duplicate_override_reason: "x" }))
    expect(res.status).toBe(400)
    expect(patientInsert).not.toHaveBeenCalled()
  })

  it("denies a caller without registration.patient.register before any lookup", async () => {
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const { POST } = await import("./route")
    const res = await POST(post({}))
    expect(res.status).toBe(403)
    expect(findDuplicatePatients).not.toHaveBeenCalled()
  })
})
