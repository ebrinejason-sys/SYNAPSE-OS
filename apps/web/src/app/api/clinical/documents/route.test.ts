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
  clinicalDocumentTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

function staffCtx() {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "doc@example.test",
    role: "doctor",
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

describe("clinical documents route", () => {
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

  it("denies unauthenticated create", async () => {
    requireHospitalStaffContext.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    const { POST } = await import("./route")
    const res = await POST(
      new NextRequest("https://synapseos.tech/api/clinical/documents", {
        method: "POST",
        body: JSON.stringify({
          patient_id: PATIENT,
          document_type: "SICK_NOTE",
          template_id: "sick.note",
          template_version: "v1",
          rendered_snapshot: "Rest 48 hours",
        }),
        headers: { "content-type": "application/json" },
      }),
    )
    expect(res.status).toBe(401)
  })

  it("creates a tenant-bound draft document", async () => {
    dbFrom.mockImplementation(
      tableMock({
        patients: { data: { id: PATIENT, person_id: null } },
        encounters: { data: { id: ENCOUNTER, patient_id: PATIENT } },
        clinical_documents: { data: null, error: null },
      }),
    )
    const { POST } = await import("./route")
    const res = await POST(
      new NextRequest("https://synapseos.tech/api/clinical/documents", {
        method: "POST",
        body: JSON.stringify({
          patient_id: PATIENT,
          encounter_id: ENCOUNTER,
          document_type: "SICK_NOTE",
          template_id: "sick.note",
          template_version: "v1",
          rendered_snapshot: "Rest 48 hours",
        }),
        headers: { "content-type": "application/json" },
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.document.status).toBe("draft")
    expect(body.document.tenantId).toBe(TENANT)
    expect(body.document.patientId).toBe(PATIENT)
  })

  it("does not create a document for a patient outside the tenant", async () => {
    dbFrom.mockImplementation(tableMock({ patients: { data: null } }))
    const { POST } = await import("./route")
    const res = await POST(
      new NextRequest("https://synapseos.tech/api/clinical/documents", {
        method: "POST",
        body: JSON.stringify({
          patient_id: PATIENT,
          document_type: "SICK_NOTE",
          template_id: "sick.note",
          template_version: "v1",
          rendered_snapshot: "Rest 48 hours",
        }),
        headers: { "content-type": "application/json" },
      }),
    )
    expect(res.status).toBe(404)
  })
})
