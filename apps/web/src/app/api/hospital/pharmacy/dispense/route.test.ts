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
  dbRpc,
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
  dbRpc: vi.fn(),
}))

vi.mock("@/lib/hospital-dept", async () => {
  const { z } = await import("zod")
  return {
    requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
    hospitalDispenseSchema: z.object({
      prescription_id: z.string().uuid(),
      product_id: z.string().uuid(),
      pharmacy_tenant_id: z.string().uuid(),
      payment_method: z.string().min(1).max(40).default("cash"),
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
  supabaseAdmin: {
    from: (...args: unknown[]) => dbFrom(...args),
    rpc: (...args: unknown[]) => dbRpc(...args),
  },
}))

vi.mock("@synapse/db/prescription-persist", async () => {
  const actual = await vi.importActual<typeof import("@synapse/db/prescription-persist")>(
    "@synapse/db/prescription-persist",
  )
  return {
    ...actual,
    persistClinicalPrescriptionBestEffort: (...args: unknown[]) => persistClinicalPrescriptionBestEffort(...args),
  }
})

vi.mock("@synapse/db/work-queue-persist", () => ({
  persistWorkQueueArtifactsBestEffort: (...args: unknown[]) => persistWorkQueueArtifactsBestEffort(...args),
  persistDomainEventsBestEffort: (...args: unknown[]) => persistDomainEventsBestEffort(...args),
}))

vi.mock("@synapse/db/clinical-timeline", () => ({
  medicationDispensedTimelineEvent: (input: unknown) => input,
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
const PHARMACIST = "77777777-7777-4777-8777-777777777777"
const PRESCRIBER = "55555555-5555-4555-8555-555555555555"
const RX = "88888888-8888-4888-8888-888888888888"
const PRODUCT = "99999999-9999-4999-8999-999999999999"
const PHARM_TENANT = "66666666-6666-4666-8666-666666666666"

function staffCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: PHARMACIST,
    email: "pharmacist@example.test",
    role: "pharmacist",
    tenantId: TENANT,
    hospitalId: HOSPITAL,
    facilityType: "hospital",
    fullName: "Rx Test",
    ...overrides,
  }
}

function rxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RX,
    tenant_id: TENANT,
    pharmacy_tenant_id: PHARM_TENANT,
    patient_id: PATIENT,
    person_id: null,
    encounter_id: ENCOUNTER,
    care_plan_id: null,
    medication_display: "Paracetamol 500mg",
    dose: "1 tablet TID",
    quantity: 5,
    unit: "tablet",
    prescriber_id: PRESCRIBER,
    verifier_id: null,
    dispenser_id: null,
    status: "active",
    correlation_id: ENCOUNTER,
    is_synthetic: true,
    simulation_run_id: null,
    ...overrides,
  }
}

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown; rows?: unknown }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "order", "limit", "update"]) {
      api[method] = vi.fn(self)
    }
    api.maybeSingle = vi.fn(async () => ({ data: handler.data ?? null, error: handler.error ?? null }))
    api.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({ data: handler.rows ?? handler.data ?? null, error: handler.error ?? null }).then(
        resolve,
        reject,
      )
    return api
  }
}

function postBody(body: Record<string, unknown>) {
  return new NextRequest("https://synapseos.tech/api/hospital/pharmacy/dispense", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    prescription_id: RX,
    product_id: PRODUCT,
    pharmacy_tenant_id: PHARM_TENANT,
    payment_method: "cash",
    ...overrides,
  }
}

describe("POST /api/hospital/pharmacy/dispense", () => {
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
    dbRpc.mockResolvedValue({ data: { sale_id: "sale-1" }, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns auth denial before loading prescriptions", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    requireHospitalStaffContext.mockResolvedValue(denied)

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(401)
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("blocks callers missing prescription.dispense", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 })
    requireHospitalCapability.mockResolvedValue(forbidden)

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res).toBe(forbidden)
    expect(requireHospitalCapability).toHaveBeenCalledWith(
      expect.objectContaining({ role: "pharmacist" }),
      "prescription",
      "dispense",
      "dispensing",
    )
  })

  it("rejects invalid bodies with 400", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())

    const { POST } = await import("./route")
    const res = await POST(postBody({ prescription_id: "bad" }))
    expect(res.status).toBe(400)
  })

  it("returns 404 when prescription is missing for this tenant", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(tableMock({ clinical_prescriptions: { data: null } }))

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(404)
  })

  it("returns 409 when already dispensed", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(tableMock({ clinical_prescriptions: { data: rxRow({ status: "dispensed" }) } }))

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/Already dispensed/i)
  })

  it("fails closed on insufficient stock", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(
      tableMock({
        clinical_prescriptions: { data: rxRow({ status: "verified", verifier_id: PHARMACIST, quantity: 10 }) },
        pharmacy_products: { data: { id: PRODUCT, price: 500, name: "Paracetamol 500mg", is_active: true } },
        pharmacy_stock: { rows: [{ quantity: 2 }] },
      }),
    )

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("INSUFFICIENT_STOCK")
    expect(dbRpc).not.toHaveBeenCalled()
  })

  it("dispenses an active prescription when verify+dispense capabilities pass", async () => {
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(
      tableMock({
        clinical_prescriptions: { data: rxRow({ status: "active", quantity: 3 }) },
        pharmacy_products: { data: { id: PRODUCT, price: 500, name: "Paracetamol 500mg", is_active: true } },
        pharmacy_stock: { rows: [{ quantity: 20 }] },
        department_tasks: { data: { id: "task-1" } },
        billing_invoices: { data: null },
      }),
    )

    const { POST } = await import("./route")
    const res = await POST(postBody(validBody()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.prescription.status).toBe("dispensed")
    expect(json.remainingStock).toBe(17)
    expect(json.sale).toEqual({ sale_id: "sale-1" })
    expect(dbRpc).toHaveBeenCalledWith(
      "complete_pharmacy_sale",
      expect.objectContaining({
        p_tenant_id: PHARM_TENANT,
        p_idempotency_key: `clinical_prescriptions:${RX}`,
      }),
    )
    expect(requireHospitalCapability).toHaveBeenCalledWith(
      expect.anything(),
      "prescription",
      "verify",
      "dispensing",
    )
    expect(logHospitalAudit).toHaveBeenCalled()
  })
})
