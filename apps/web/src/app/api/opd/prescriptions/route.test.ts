import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  logHospitalAudit,
  persistClinicalPrescriptionBestEffort,
  persistWorkQueueArtifactsBestEffort,
  persistDomainEventsBestEffort,
  appendClinicalChargeBestEffort,
  publishClinicalTimelineBestEffort,
  publishTimelineEvent,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  logHospitalAudit: vi.fn(),
  persistClinicalPrescriptionBestEffort: vi.fn(),
  persistWorkQueueArtifactsBestEffort: vi.fn(),
  persistDomainEventsBestEffort: vi.fn(),
  appendClinicalChargeBestEffort: vi.fn(),
  publishClinicalTimelineBestEffort: vi.fn(),
  publishTimelineEvent: vi.fn(),
  dbFrom: vi.fn(),
}))

vi.mock("@/lib/hospital-dept", async () => {
  const { z } = await import("zod")
  return {
    requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
    prescriptionCreateSchema: z.object({
      encounter_id: z.string().uuid(),
      patient_id: z.string().uuid(),
      medication_display: z.string().min(1).max(500),
      dose: z.string().min(1).max(2000),
      quantity: z.coerce.number().positive(),
      unit: z.string().min(1).max(40).default("unit"),
      care_plan_id: z.string().uuid().optional(),
      person_id: z.string().uuid().optional(),
      pharmacy_tenant_id: z.string().uuid().optional(),
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

vi.mock("@synapse/db/prescription-persist", () => ({
  persistClinicalPrescriptionBestEffort: (...args: unknown[]) => persistClinicalPrescriptionBestEffort(...args),
}))

vi.mock("@synapse/db/work-queue-persist", () => ({
  persistWorkQueueArtifactsBestEffort: (...args: unknown[]) => persistWorkQueueArtifactsBestEffort(...args),
  persistDomainEventsBestEffort: (...args: unknown[]) => persistDomainEventsBestEffort(...args),
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  prescriptionTimelineEvent: (input: unknown) => input,
  publishClinicalTimelineBestEffort: (...args: unknown[]) => publishClinicalTimelineBestEffort(...args),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: (...args: unknown[]) => publishTimelineEvent(...args),
}))

vi.mock("@synapse/db/clinical-charge", () => ({
  appendClinicalChargeBestEffort: (...args: unknown[]) => appendClinicalChargeBestEffort(...args),
  recordInvoiceCreatedEvent: () => ({ list: () => [] }),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"
const DOCTOR = "55555555-5555-4555-8555-555555555555"
const PHARM_TENANT = "66666666-6666-4666-8666-666666666666"

function staffCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: DOCTOR,
    email: "doctor@example.test",
    role: "doctor",
    tenantId: TENANT,
    hospitalId: HOSPITAL,
    facilityType: "hospital",
    fullName: "Dr Test",
    ...overrides,
  }
}

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {}
  const self = () => api
  for (const method of ["select", "eq", "order", "limit", "update"]) {
    api[method] = vi.fn(self)
  }
  api.maybeSingle = vi.fn(async () => result)
  api.upsert = vi.fn(async () => ({ error: null }))
  return api
}

function postBody(body: Record<string, unknown>) {
  return new NextRequest("https://synapseos.tech/api/opd/prescriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    encounter_id: ENCOUNTER,
    patient_id: PATIENT,
    medication_display: "Paracetamol 500mg",
    dose: "1 tablet TID",
    quantity: 9,
    unit: "tablet",
    pharmacy_tenant_id: PHARM_TENANT,
    ...overrides,
  }
}

describe("POST /api/opd/prescriptions", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    persistClinicalPrescriptionBestEffort.mockResolvedValue({ ok: true })
    persistWorkQueueArtifactsBestEffort.mockResolvedValue({ errors: [] })
    persistDomainEventsBestEffort.mockResolvedValue({ errors: [] })
    appendClinicalChargeBestEffort.mockResolvedValue({
      ok: true,
      result: { created: false, invoiceId: "inv-1", totalAmount: 0 },
    })
    publishClinicalTimelineBestEffort.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns the auth denial response before creating a prescription", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    requireHospitalStaffContext.mockResolvedValue(denied)

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(401)
    expect(requireHospitalCapability).not.toHaveBeenCalled()
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("blocks callers missing prescription.create", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 })
    requireHospitalCapability.mockResolvedValue(forbidden)

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res).toBe(forbidden)
    expect(requireHospitalCapability).toHaveBeenCalledWith(
      expect.objectContaining({ userId: DOCTOR }),
      "prescription",
      "create",
      "opd",
    )
  })

  it("rejects invalid bodies with 400", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())

    const { POST } = await import("./route")
    const res = await POST(postBody({ encounter_id: "not-a-uuid" }))
    expect(res.status).toBe(400)
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("returns 404 when the encounter is missing for this tenant", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockReturnValue(chain({ data: null, error: null }))

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Encounter not found/i)
  })

  it("returns 400 when patient_id does not match the encounter", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockReturnValue(
      chain({
        data: { id: ENCOUNTER, patient_id: "99999999-9999-4999-8999-999999999999", tenant_id: TENANT },
        error: null,
      }),
    )

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Patient does not match/i)
  })

  it("creates a prescription and returns 201 with correlation id", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockReturnValue(
      chain({
        data: { id: ENCOUNTER, patient_id: PATIENT, tenant_id: TENANT },
        error: null,
      }),
    )

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.prescriptionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(json.correlationId).toBe(ENCOUNTER)
    expect(json.pharmacyTaskId).toBeTruthy()
    expect(persistClinicalPrescriptionBestEffort).toHaveBeenCalled()
    expect(logHospitalAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INSERT",
        tableName: "clinical_prescriptions",
      }),
    )
  })
})
