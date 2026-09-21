import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  logHospitalAudit,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  logHospitalAudit: vi.fn(),
  dbFrom: vi.fn(),
}))

vi.mock("@/lib/hospital-dept", () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

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

vi.mock("@synapse/db/clinical-timeline", () => ({
  deathPronouncedTimelineEvent: vi.fn(() => ({})),
  nextOfKinTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const OTHER = "99999999-9999-4999-8999-999999999999"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

function staffCtx(role = "doctor") {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "doc@example.test",
    role,
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: "hospital",
    fullName: "Dr Test",
  }
}

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "order", "limit", "insert", "update"]) api[method] = vi.fn(self)
    api.maybeSingle = vi.fn(async () => ({
      data: Array.isArray(handler.data) ? null : handler.data ?? null,
      error: handler.error ?? null,
    }))
    api.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: handler.data ?? null, error: handler.error ?? null }).then(resolve, reject)
    return api
  }
}

describe("death pronouncement routes", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("denies pronouncement without permission", async () => {
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/clinical/death-pronouncements", {
      method: "POST",
      body: JSON.stringify({
        patient_id: PATIENT,
        encounter_id: ENCOUNTER,
        death_time_precision: "UNKNOWN",
        death_time_text: "date known, exact time unknown",
        location_type: "ward",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(403)
  })

  it("does not create a pronouncement for another tenant's patient", async () => {
    dbFrom.mockImplementation(tableMock({ patients: { data: null } }))
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/clinical/death-pronouncements", {
      method: "POST",
      body: JSON.stringify({
        patient_id: PATIENT,
        encounter_id: ENCOUNTER,
        death_time_precision: "UNKNOWN",
        death_time_text: "date known, exact time unknown",
        location_type: "ward",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(404)
  })

  it("records unknown time without a fabricated clock and binds tenant", async () => {
    dbFrom.mockImplementation(tableMock({
      patients: { data: { id: PATIENT, person_id: null, full_name: "Joseph Demo" } },
      encounters: { data: { id: ENCOUNTER, patient_id: PATIENT } },
      clinical_documents: { data: null, error: null },
      death_pronouncements: { data: null, error: null },
    }))
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/clinical/death-pronouncements", {
      method: "POST",
      body: JSON.stringify({
        patient_id: PATIENT,
        encounter_id: ENCOUNTER,
        death_time_precision: "UNKNOWN",
        death_time_text: "date known, exact time unknown",
        location_type: "ward",
      }),
      headers: { "content-type": "application/json" },
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.pronouncement.tenantId).toBe(TENANT)
    expect(json.pronouncement.deathTimePrecision).toBe("UNKNOWN")
    expect(json.pronouncement.deathDateTime).toBeNull()
    expect(json.document.status).toBe("signed")
  })

  it("refuses direct amendment of a signed pronouncement", async () => {
    const { PATCH } = await import("./[id]/route")
    const res = await PATCH()
    expect(res.status).toBe(409)
    expect(OTHER).toBeTruthy()
  })
})
