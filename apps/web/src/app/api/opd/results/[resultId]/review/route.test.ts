import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { requireHospitalStaffContext, requireHospitalCapability, gateHospitalModule, requireHospitalAudit, persist, tables } = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
  gateHospitalModule: vi.fn(),
  requireHospitalAudit: vi.fn(),
  persist: vi.fn(),
  tables: { current: {} as Record<string, unknown> },
}))

vi.mock("@/lib/hospital-dept", () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

vi.mock("@/lib/hospital-shared", async () => {
  const { NextResponse } = await import("next/server")
  class HospitalAuditRequiredError extends Error {}
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> => value instanceof NextResponse,
    requireHospitalCapability: (...args: unknown[]) => requireHospitalCapability(...args),
    gateHospitalModule: (...args: unknown[]) => gateHospitalModule(...args),
    requireHospitalAudit: (...args: unknown[]) => requireHospitalAudit(...args),
    HospitalAuditRequiredError,
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const api: Record<string, unknown> = {}
      for (const m of ["select", "eq", "in", "limit"]) api[m] = () => api
      const data = tables.current[table]
      api.maybeSingle = async () => ({ data: Array.isArray(data) ? data[0] ?? null : data ?? null, error: null })
      api.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: Array.isArray(data) ? data : [], error: null }).then(resolve)
      return api
    },
  },
}))

vi.mock("@synapse/db/work-queue-persist", () => ({
  rowToDepartmentTask: (row: Record<string, unknown>) => ({ ...row }),
  persistWorkQueueArtifactsBestEffort: (...args: unknown[]) => persist(...args),
}))

vi.mock("@synapse/db/work-queue", () => ({
  WorkQueue: class {
    tasks = new Map<string, { id: string; status: string }>()
    start(id: string) {
      const t = this.tasks.get(id)!
      this.tasks.set(id, { ...t, status: "IN_PROGRESS" })
      return { ok: true }
    }
    complete(id: string) {
      const t = this.tasks.get(id)!
      this.tasks.set(id, { ...t, status: "COMPLETED" })
      return { ok: true }
    }
    get(id: string) {
      return this.tasks.get(id)
    }
    create(input: Record<string, unknown>) {
      return { ok: true, task: { id: "new", ...input } }
    }
  },
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  clinicalActionTimelineEvent: (input: unknown) => input,
  publishClinicalTimelineBestEffort: vi.fn(),
}))
vi.mock("@synapse/db/identity-persist", () => ({ publishTimelineEvent: vi.fn() }))

const TENANT = "11111111-1111-4111-8111-111111111111"
const HOSPITAL = "22222222-2222-4222-8222-222222222222"
const RESULT = "66666666-6666-4666-8666-666666666666"
const ENCOUNTER = "44444444-4444-4444-8444-444444444444"

function released(overrides: Record<string, unknown> = {}) {
  return {
    id: RESULT,
    lab_order_id: "order-1",
    patient_id: "p1",
    status: "final",
    released_to_patient_at: "2026-09-28T10:00:00Z",
    lab_orders: { id: "order-1", tenant_id: TENANT, encounter_id: ENCOUNTER, workflow_status: "RELEASED", test_name: "FBC" },
    ...overrides,
  }
}

async function post() {
  const { POST } = await import("./route")
  return POST(new NextRequest(`https://synapseos.tech/api/opd/results/${RESULT}/review`, { method: "POST" }), {
    params: Promise.resolve({ resultId: RESULT }),
  })
}

describe("POST /api/opd/results/[resultId]/review", () => {
  beforeEach(() => {
    requireHospitalStaffContext.mockResolvedValue({ userId: "doc-1", role: "doctor", tenantId: TENANT, hospitalId: HOSPITAL, facilityType: "hospital" })
    requireHospitalCapability.mockResolvedValue(null)
    gateHospitalModule.mockResolvedValue(null)
    requireHospitalAudit.mockResolvedValue(undefined)
    persist.mockResolvedValue({ errors: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("completes the open review task and writes a required audit row", async () => {
    tables.current = {
      lab_results: released(),
      encounters: { id: ENCOUNTER, hospital_id: HOSPITAL },
      department_tasks: [{ id: "task-1", status: "REQUESTED" }],
      clinical_prescriptions: [],
      billing_invoices: null,
    }
    const res = await post()
    expect(res.status).toBe(200)
    expect((await res.json()).reviewed).toBe(true)
    expect(persist).toHaveBeenCalledWith(expect.anything(), { tasks: [expect.objectContaining({ id: "task-1", status: "COMPLETED" })], events: [] })
    expect(requireHospitalAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "RESULT_REVIEWED", recordId: RESULT }))
  })

  it("is idempotent once the review task is completed and audited", async () => {
    tables.current = {
      lab_results: released(),
      encounters: { id: ENCOUNTER, hospital_id: HOSPITAL },
      department_tasks: [{ id: "task-1", status: "COMPLETED" }],
      audit_log: { id: "audit-1" },
    }
    const res = await post()
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyReviewed).toBe(true)
    expect(persist).not.toHaveBeenCalled()
    expect(requireHospitalAudit).not.toHaveBeenCalled()
  })

  it("writes the missing audit row when a retry finds the task completed but unaudited", async () => {
    tables.current = {
      lab_results: released(),
      encounters: { id: ENCOUNTER, hospital_id: HOSPITAL },
      department_tasks: [{ id: "task-1", status: "COMPLETED" }],
      audit_log: null,
      clinical_prescriptions: [],
      billing_invoices: null,
    }
    const res = await post()
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyReviewed).toBeUndefined()
    expect(persist).not.toHaveBeenCalled()
    expect(requireHospitalAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "RESULT_REVIEWED", recordId: RESULT }))
  })

  it("asks for a retry when the required audit fails after completing the task", async () => {
    const { HospitalAuditRequiredError } = await import("@/lib/hospital-shared")
    requireHospitalAudit.mockRejectedValue(new HospitalAuditRequiredError("AUDIT_REQUIRED_FAILED"))
    tables.current = {
      lab_results: released(),
      encounters: { id: ENCOUNTER, hospital_id: HOSPITAL },
      department_tasks: [{ id: "task-1", status: "REQUESTED" }],
      audit_log: null,
      clinical_prescriptions: [],
      billing_invoices: null,
    }
    const res = await post()
    expect(res.status).toBe(503)
    expect((await res.json()).outcome).toBe("retry")
  })

  it("rejects review before release", async () => {
    tables.current = {
      lab_results: released({ released_to_patient_at: null }),
      encounters: { id: ENCOUNTER, hospital_id: HOSPITAL },
    }
    expect((await post()).status).toBe(409)
    expect(requireHospitalAudit).not.toHaveBeenCalled()
  })

  it("hides results from another hospital in the same tenant", async () => {
    tables.current = {
      lab_results: released(),
      encounters: { id: ENCOUNTER, hospital_id: "99999999-9999-4999-8999-999999999999" },
    }
    expect((await post()).status).toBe(404)
  })

  it("denies roles without opd.result.review", async () => {
    const { NextResponse } = await import("next/server")
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    expect((await post()).status).toBe(403)
    expect(requireHospitalAudit).not.toHaveBeenCalled()
  })
})
