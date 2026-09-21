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
const USER = "55555555-5555-4555-8555-555555555555"

function staffCtx() {
  return {
    userId: USER,
    email: "manager@example.test",
    role: "mortuary_manager",
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: "hospital",
    fullName: "Mortuary Manager",
  }
}

function storedRow() {
  return {
    id: BODY_ID,
    tenant_id: TENANT,
    facility_id: TENANT,
    pronouncement_id: "77777777-7777-4777-8777-777777777777",
    encounter_id: null,
    status: "stored",
    identity: { bodyNumber: "MB-1", tagCode: "TAG-1", unknownPerson: false, patientId: "p1" },
    storage: { mortuaryId: "main", slotCode: "A-12" },
    property: [],
    release: { authorized: false },
    is_synthetic: true,
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    audit: [],
  }
}

function tableMock() {
  const inserted: unknown[] = []
  const slotUpdates: unknown[] = []
  const bodyUpdates: unknown[] = []
  const impl = (table: string) => {
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ["select", "eq", "not"]) api[method] = vi.fn(self)
    api.insert = vi.fn((payload: unknown) => {
      inserted.push(payload)
      return api
    })
    api.update = vi.fn((payload: unknown) => {
      if (table === "mortuary_storage_slots") slotUpdates.push(payload)
      if (table === "mortuary_bodies") bodyUpdates.push(payload)
      return api
    })
    api.maybeSingle = vi.fn(async () => ({ data: table === "mortuary_bodies" ? storedRow() : null, error: null }))
    api.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(resolve, reject)
    return api
  }
  return { impl, inserted, slotUpdates, bodyUpdates }
}

async function postRelease(body: Record<string, unknown>) {
  const { POST } = await import("./route")
  return POST(new NextRequest(`https://synapseos.tech/api/mortuary/bodies/${BODY_ID}/release`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }), { params: Promise.resolve({ id: BODY_ID }) })
}

describe("dedicated mortuary release workflow", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    logHospitalAudit.mockResolvedValue(undefined)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("denies release without approval capability", async () => {
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const res = await postRelease({
      recipient_name: "Relative",
      recipient_identity: "NIN-1",
      relationship_or_authority: "son",
    })
    expect(res.status).toBe(403)
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "release", "approve", "mortuary")
  })

  it("denies release without recipient identity", async () => {
    const mock = tableMock()
    dbFrom.mockImplementation(mock.impl)
    const res = await postRelease({
      recipient_name: "Relative",
      recipient_identity: "",
      relationship_or_authority: "son",
    })
    expect(res.status).toBe(400)
  })

  it("authorizes and completes release with document, staff identity, timestamp, slot clearance, and audit", async () => {
    const mock = tableMock()
    dbFrom.mockImplementation(mock.impl)
    const res = await postRelease({
      recipient_name: "Relative",
      recipient_identity: "NIN-1",
      relationship_or_authority: "next of kin",
      complete_release: true,
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.body.status).toBe("released")
    expect(json.body.release.authorized).toBe(true)
    expect(json.body.release.recipientName).toBe("Relative")
    expect(json.body.release.recipientIdentity).toBe("NIN-1")
    expect(json.body.release.staffId).toBe(USER)
    expect(json.body.release.releasedAt).toBeTruthy()
    expect(json.body.releaseDocumentId).toBeTruthy()
    expect(mock.inserted[0]).toMatchObject({ document_type: "BODY_RELEASE" })
    expect(mock.slotUpdates).toContainEqual(expect.objectContaining({ occupied_body_id: null }))
    expect(logHospitalAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "UPDATE",
      tableName: "mortuary_bodies",
      recordId: BODY_ID,
      newValue: expect.objectContaining({ status: "released", authorized: true }),
    }))
  })
})
