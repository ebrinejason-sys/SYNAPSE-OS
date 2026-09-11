import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  gateHospitalModule,
  logHospitalAudit,
  publishClinicalTimelineBestEffort,
  publishTimelineEvent,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  logHospitalAudit: vi.fn(),
  publishClinicalTimelineBestEffort: vi.fn(),
  publishTimelineEvent: vi.fn(),
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
  clinicalActionTimelineEvent: (input: unknown) => input,
  publishClinicalTimelineBestEffort: (...args: unknown[]) => publishClinicalTimelineBestEffort(...args),
}))

vi.mock("@synapse/db/identity-persist", () => ({
  publishTimelineEvent: (...args: unknown[]) => publishTimelineEvent(...args),
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

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

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "not", "in", "limit", "update"]) api[method] = vi.fn(self)
    api.maybeSingle = vi.fn(async () => ({ data: Array.isArray(handler.data) ? null : handler.data ?? null, error: handler.error ?? null }))
    api.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: handler.data ?? null, error: handler.error ?? null }).then(resolve, reject)
    return api
  }
}

describe("POST /api/opd/encounters/[encounterId]/close", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    publishClinicalTimelineBestEffort.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns auth denial before loading the encounter", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    requireHospitalStaffContext.mockResolvedValue(denied)
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/opd/encounters/x/close", { method: "POST" }), {
      params: Promise.resolve({ encounterId: ENCOUNTER }),
    })
    expect(res.status).toBe(401)
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("blocks close when billing balance remains", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(
      tableMock({
        encounters: {
          data: { id: ENCOUNTER, hospital_id: HOSPITAL, patient_id: "p1", status: "open", disposition: "CLINICAL_COMPLETE" },
        },
        lab_orders: { data: [] },
        lab_results: { data: [] },
        clinical_prescriptions: { data: [] },
        billing_invoices: { data: { id: "inv-1", status: "issued", total_amount: 100, paid_amount: 20 } },
        department_tasks: { data: [] },
      }),
    )
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/opd/encounters/x/close", { method: "POST" }), {
      params: Promise.resolve({ encounterId: ENCOUNTER }),
    })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.blocking).toBe("BILLING")
  })

  it("closes when all gates are clear", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(
      tableMock({
        encounters: {
          data: { id: ENCOUNTER, hospital_id: HOSPITAL, patient_id: "p1", status: "open", disposition: "CLINICAL_COMPLETE" },
        },
        lab_orders: { data: [] },
        lab_results: { data: [] },
        clinical_prescriptions: { data: [] },
        billing_invoices: { data: { id: "inv-1", status: "paid", total_amount: 100, paid_amount: 100 } },
        department_tasks: { data: [] },
      }),
    )
    const { POST } = await import("./route")
    const res = await POST(new NextRequest("https://synapseos.tech/api/opd/encounters/x/close", { method: "POST" }), {
      params: Promise.resolve({ encounterId: ENCOUNTER }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.closed).toBe(true)
    expect(logHospitalAudit).toHaveBeenCalled()
  })
})
