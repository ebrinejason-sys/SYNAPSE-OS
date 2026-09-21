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
  mortuaryTransferTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const PRONOUNCEMENT = "77777777-7777-4777-8777-777777777777"
const PATIENT = "33333333-3333-4333-8333-333333333333"

function staffCtx() {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "mortuary@example.test",
    role: "mortuary_manager",
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: "hospital",
    fullName: "Mortuary Manager",
  }
}

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "order", "limit", "insert", "update", "upsert", "not"]) api[method] = vi.fn(self)
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

describe("mortuary routes", () => {
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

  it("does not admit a body from another tenant pronouncement", async () => {
    dbFrom.mockImplementation(tableMock({ death_pronouncements: { data: null } }))
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/mortuary/bodies", {
      method: "POST",
      body: JSON.stringify({ pronouncement_id: PRONOUNCEMENT }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(404)
  })

  it("creates a tenant-bound body with public tag metadata only", async () => {
    dbFrom.mockImplementation(tableMock({
      death_pronouncements: { data: { id: PRONOUNCEMENT, patient_id: PATIENT, person_id: null, encounter_id: null, is_synthetic: true } },
      clinical_documents: { data: null, error: null },
      mortuary_bodies: { data: null, error: null },
    }))
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/mortuary/bodies", {
      method: "POST",
      body: JSON.stringify({ pronouncement_id: PRONOUNCEMENT }),
      headers: { "content-type": "application/json" },
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.body.tenantId).toBe(TENANT)
    expect(json.publicTag.bodyNumber).toBeTruthy()
    expect(json.publicTag.fullName).toBeUndefined()
  })

  it("denies release without authorization capability", async () => {
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const { POST } = await import("./[id]/release/route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/mortuary/bodies/b1/release", {
      method: "POST",
      body: JSON.stringify({ recipient_name: "Relative", recipient_identity: "NIN", relationship_or_authority: "son" }),
      headers: { "content-type": "application/json" },
    }), { params: Promise.resolve({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) })
    expect(res.status).toBe(403)
  })
})
