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

vi.mock("@synapse/db/work-queue", () => ({
  WorkQueue: class { tasks = new Map() },
}))

vi.mock("@synapse/db/work-queue-persist", () => ({
  rowToDepartmentTask: vi.fn(),
  persistWorkQueueArtifactsBestEffort: vi.fn(async () => ({ errors: [] })),
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  clinicalActionTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"
const PATIENT = "33333333-3333-4333-8333-333333333333"
const PERSON = "99999999-9999-4999-8999-999999999999"
const PRONOUNCEMENT = "77777777-7777-4777-8777-777777777777"

function staffCtx() {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "doc@example.test",
    role: "doctor",
    tenantId: TENANT,
    hospitalId: HOSPITAL,
    facilityType: "hospital",
    fullName: "Dr Test",
  }
}

function encounterRow() {
  return {
    id: ENCOUNTER,
    tenant_id: TENANT,
    hospital_id: HOSPITAL,
    patient_id: PATIENT,
    person_id: PERSON,
    disposition: null,
  }
}

function pronouncementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRONOUNCEMENT,
    tenant_id: TENANT,
    facility_id: HOSPITAL,
    patient_id: PATIENT,
    person_id: PERSON,
    encounter_id: ENCOUNTER,
    status: "pronounced",
    death_time_precision: "EXACT",
    death_date_time: "2026-09-21T03:42:00+03:00",
    pronounced_at: "2026-09-21T03:50:00+03:00",
    pronounced_by: "55555555-5555-4555-8555-555555555555",
    location_type: "ward",
    resuscitation_attempted: false,
    external_cause_suspected: false,
    traumatic_death: false,
    suspicious_death: false,
    medicolegal_flags: [],
    findings: {},
    cause_of_death: [],
    certified_at: null,
    certified_by: null,
    created_at: "2026-09-21T03:50:00+03:00",
    updated_at: "2026-09-21T03:50:00+03:00",
    audit: [],
    ...overrides,
  }
}

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown; onUpdate?: (p: unknown) => void }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "not", "in", "limit"]) api[method] = vi.fn(self)
    api.update = vi.fn((payload: unknown) => {
      handler.onUpdate?.(payload)
      return api
    })
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

async function postDisposition(body: Record<string, unknown>) {
  const { POST } = await import("./route")
  return POST(new NextRequest(`https://synapseos.tech/api/opd/encounters/${ENCOUNTER}/disposition`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }), { params: Promise.resolve({ id: ENCOUNTER }) })
}

describe("DECEASED disposition pronouncement binding", () => {
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

  it("denies DECEASED without a pronouncement id", async () => {
    const res = await postDisposition({ disposition: "DECEASED" })
    expect(res.status).toBe(409)
  })

  it("rejects a malformed pronouncement UUID", async () => {
    const res = await postDisposition({ disposition: "DECEASED", pronouncement_id: "not-a-uuid" })
    expect(res.status).toBe(400)
  })

  it("denies a nonexistent pronouncement", async () => {
    dbFrom.mockImplementation(tableMock({
      encounters: { data: encounterRow() },
      death_pronouncements: { data: null },
    }))
    const res = await postDisposition({ disposition: "DECEASED", pronouncement_id: PRONOUNCEMENT })
    expect(res.status).toBe(404)
  })

  it("denies a Tenant B pronouncement with the same not-found response", async () => {
    dbFrom.mockImplementation(tableMock({
      encounters: { data: encounterRow() },
      death_pronouncements: { data: null },
    }))
    const res = await postDisposition({
      disposition: "DECEASED",
      pronouncement_id: "88888888-8888-4888-8888-888888888888",
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Pronouncement not found" })
  })

  it("denies a pronouncement for a different patient", async () => {
    dbFrom.mockImplementation(tableMock({
      encounters: { data: encounterRow() },
      death_pronouncements: { data: pronouncementRow({ patient_id: "33333333-3333-4333-8333-333333333334" }) },
    }))
    const res = await postDisposition({ disposition: "DECEASED", pronouncement_id: PRONOUNCEMENT })
    expect(res.status).toBe(409)
  })

  it("denies a pronouncement for a different encounter", async () => {
    dbFrom.mockImplementation(tableMock({
      encounters: { data: encounterRow() },
      death_pronouncements: { data: pronouncementRow({ encounter_id: "44444444-4444-4444-8444-444444444445" }) },
    }))
    const res = await postDisposition({ disposition: "DECEASED", pronouncement_id: PRONOUNCEMENT })
    expect(res.status).toBe(409)
  })

  it("persists DECEASED against a pronounced, uncertified same-identity record", async () => {
    let update: Record<string, unknown> | null = null
    dbFrom.mockImplementation(tableMock({
      encounters: {
        data: encounterRow(),
        onUpdate: (payload) => { update = payload as Record<string, unknown> },
      },
      death_pronouncements: { data: pronouncementRow() },
    }))
    const res = await postDisposition({ disposition: "DECEASED", pronouncement_id: PRONOUNCEMENT })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.disposition).toBe("DECEASED")
    expect(json.deathPronouncementId).toBe(PRONOUNCEMENT)
    expect(update).toMatchObject({
      disposition: "DECEASED",
      death_pronouncement_id: PRONOUNCEMENT,
      disposition_by: staffCtx().userId,
    })
    expect(update?.disposition_at).toBeTruthy()
  })
})
