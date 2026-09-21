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

describe("pathway care plan routes", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("lists the catalog for the authenticated tenant country pack", async () => {
    const { GET } = await import("./route")
    const res = await GET(new NextRequest("https://synapseos.tech/api/clinical/pathways?presenting=fever"))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.tenantId).toBe(TENANT)
    expect(json.pathways.some((row: { id: string }) => row.id === "pathway.adult-sepsis")).toBe(true)
  })

  it("rejects AI auto-activation", async () => {
    dbFrom.mockImplementation(tableMock({
      encounters: { data: { id: ENCOUNTER, patient_id: PATIENT } },
      patient_care_plans: { data: null, error: null },
    }))
    const { POST } = await import("./care-plans/route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/clinical/pathways/care-plans", {
      method: "POST",
      body: JSON.stringify({
        patient_id: PATIENT,
        encounter_id: ENCOUNTER,
        pathway_id: "pathway.adult-sepsis",
        actor_kind: "ai",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(403)
  })
})
