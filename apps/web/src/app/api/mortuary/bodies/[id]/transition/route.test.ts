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
    logHospitalAudit: (...args: unknown[]) => logHospitalAudit(...args),
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const BODY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const COMMAND_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function staffCtx() {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "attendant@example.test",
    role: "mortuary_attendant",
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: "hospital",
    fullName: "Mortuary Attendant",
  }
}

function storedRow(status = "stored") {
  return {
    id: BODY_ID,
    tenant_id: TENANT,
    facility_id: TENANT,
    pronouncement_id: "77777777-7777-4777-8777-777777777777",
    encounter_id: null,
    status,
    identity: { bodyNumber: "MB-1", tagCode: "TAG-1", unknownPerson: false, patientId: "p1" },
    storage: { mortuaryId: "main", slotCode: "A-12" },
    property: [],
    release: status === "release_authorized" ? { authorized: true } : { authorized: false },
    is_synthetic: true,
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    audit: [],
  }
}

function tableMock(row: Record<string, unknown>) {
  return () => {
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "not", "update"]) api[method] = vi.fn(self)
    api.maybeSingle = vi.fn(async () => ({ data: row, error: null }))
    api.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: row, error: null }).then(resolve, reject)
    return api
  }
}

async function postTransition(to: string, extra: Record<string, unknown> = {}) {
  const { POST } = await import("./route")
  return POST(new NextRequest(`https://synapseos.tech/api/mortuary/bodies/${BODY_ID}/transition`, {
    method: "POST",
    body: JSON.stringify({ to, ...extra }),
    headers: { "content-type": "application/json" },
  }), { params: Promise.resolve({ id: BODY_ID }) })
}

describe("mortuary generic custody transition", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(tableMock(storedRow()))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("denies stored → release_authorized via generic transition", async () => {
    const res = await postTransition("release_authorized")
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: "Use the authorized mortuary release workflow" })
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "custody", "write", "mortuary")
  })

  it("denies stored → released via generic transition", async () => {
    const res = await postTransition("released")
    expect(res.status).toBe(403)
  })

  it("denies release_authorized → released via generic transition", async () => {
    dbFrom.mockImplementation(tableMock(storedRow("release_authorized")))
    const res = await postTransition("released")
    expect(res.status).toBe(403)
  })

  it("denies command_id + released even when the command looks idempotent", async () => {
    dbFrom.mockImplementation(tableMock({ ...storedRow(), audit: [{ detail: COMMAND_ID }] }))
    const res = await postTransition("released", { command_id: COMMAND_ID })
    expect(res.status).toBe(403)
  })
})
