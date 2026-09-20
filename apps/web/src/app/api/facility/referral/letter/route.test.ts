import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  logHospitalAudit,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
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
    gateHospitalModule: vi.fn(async () => null),
    logHospitalAudit: (...args: unknown[]) => logHospitalAudit(...args),
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  clinicalDocumentTimelineEvent: vi.fn(() => ({})),
  referralLoopTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"
const REFERRAL = "77777777-7777-4777-8777-777777777777"

function staffCtx(tenantId = TENANT) {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "doc@example.test",
    role: "doctor",
    tenantId,
    hospitalId: tenantId,
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

const referralRow = {
  id: REFERRAL,
  from_tenant_id: TENANT,
  to_tenant_id: OTHER,
  patient_id: PATIENT,
  encounter_id: ENCOUNTER,
  status: "pending",
  speciality: "Medicine",
  urgency: "URGENT",
  clinical_summary: "Needs higher-level care",
  consent_obtained: true,
  created_by: "55555555-5555-4555-8555-555555555555",
  created_at: new Date().toISOString(),
}

describe("referral letter route", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("generates a letter whose QR payload has no PHI", async () => {
    dbFrom.mockImplementation(
      tableMock({
        facility_referrals: { data: referralRow },
        patients: { data: { id: PATIENT, full_name: "Amina Demo", mrn: "MRN-1", person_id: null } },
        clinical_documents: { data: null, error: null },
      }),
    )
    const { GET } = await import("./route")
    const res = await GET(new NextRequest(`https://synapseos.tech/api/facility/referral/letter?id=${REFERRAL}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.letter.documentType).toBe("REFERRAL_LETTER")
    expect(body.verification.phi).toBe(false)
    expect(JSON.stringify(body.verification)).not.toMatch(/Amina|Needs higher-level|MRN-1/)
  })

  it("forbids a third tenant from reading the letter", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx("99999999-9999-4999-8999-999999999999"))
    dbFrom.mockImplementation(tableMock({ facility_referrals: { data: referralRow } }))
    const { GET } = await import("./route")
    const res = await GET(new NextRequest(`https://synapseos.tech/api/facility/referral/letter?id=${REFERRAL}`))
    expect(res.status).toBe(403)
  })
})
