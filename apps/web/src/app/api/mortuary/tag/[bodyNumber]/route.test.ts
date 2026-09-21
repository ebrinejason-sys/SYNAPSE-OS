import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const {
  requireHospitalStaffContext,
  requireHospitalCapability,
  dbFrom,
} = vi.hoisted(() => ({
  requireHospitalStaffContext: vi.fn(),
  requireHospitalCapability: vi.fn(),
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
  }
})

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

const TENANT = "11111111-1111-4111-8111-111111111111"
const BODY_A = "MB-TENANT-A-1"
const BODY_B = "MB-TENANT-B-9"

function staffCtx() {
  return {
    userId: "55555555-5555-4555-8555-555555555555",
    email: "mortuary@example.test",
    role: "mortuary_attendant",
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: "hospital",
    fullName: "Mortuary Attendant",
  }
}

function lookupMock(rows: Record<string, { identity: Record<string, unknown>; tenantId: string }>) {
  return () => {
    const filters: Record<string, string> = {}
    const api: Record<string, unknown> = {}
    const self = () => api
    api.select = vi.fn(self)
    api.eq = vi.fn((column: string, value: string) => {
      filters[column] = value
      return api
    })
    api.filter = vi.fn((column: string, _op: string, value: string) => {
      filters[column] = value
      return api
    })
    api.maybeSingle = vi.fn(async () => {
      const tenantId = filters.tenant_id
      const bodyNumber = filters["identity->>bodyNumber"]
      const match = Object.values(rows).find((row) => row.tenantId === tenantId && row.identity.bodyNumber === bodyNumber)
      return { data: match ? { identity: match.identity } : null, error: null }
    })
    return api
  }
}

describe("mortuary tag lookup", () => {
  beforeEach(() => {
    requireHospitalCapability.mockResolvedValue(null)
    requireHospitalStaffContext.mockResolvedValue(staffCtx())
    dbFrom.mockImplementation(lookupMock({
      a: {
        tenantId: TENANT,
        identity: {
          bodyNumber: BODY_A,
          tagCode: "TAG-A-1",
          patientId: "33333333-3333-4333-8333-333333333333",
          personId: "99999999-9999-4999-8999-999999999999",
          fullName: "should-not-leak",
        },
      },
      b: {
        tenantId: "22222222-2222-4222-8222-222222222222",
        identity: {
          bodyNumber: BODY_B,
          tagCode: "TAG-B-9",
          patientId: "44444444-4444-4444-8444-444444444444",
          fullName: "other-tenant-phi",
        },
      },
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("rejects unauthenticated tag lookup", async () => {
    requireHospitalStaffContext.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    const { GET } = await import("./route")
    const res = await GET(new NextRequest(`https://synapseos.tech/api/mortuary/tag/${BODY_A}`), {
      params: Promise.resolve({ bodyNumber: BODY_A }),
    })
    expect(res.status).toBe(401)
    expect(dbFrom).not.toHaveBeenCalled()
  })

  it("requires mortuary register read capability", async () => {
    requireHospitalCapability.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    const { GET } = await import("./route")
    const res = await GET(new NextRequest(`https://synapseos.tech/api/mortuary/tag/${BODY_A}`), {
      params: Promise.resolve({ bodyNumber: BODY_A }),
    })
    expect(res.status).toBe(403)
    expect(requireHospitalCapability).toHaveBeenCalledWith(expect.anything(), "register", "read", "mortuary")
  })

  it("returns a tenant-scoped public tag without PHI", async () => {
    const { GET } = await import("./route")
    const res = await GET(new NextRequest(`https://synapseos.tech/api/mortuary/tag/${BODY_A}`), {
      params: Promise.resolve({ bodyNumber: BODY_A }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ kind: "mortuary_tag", found: true, bodyNumber: BODY_A, tagCode: "TAG-A-1" })
    const serialized = JSON.stringify(json)
    expect(serialized).not.toMatch(/patient/i)
    expect(serialized).not.toMatch(/person/i)
    expect(serialized).not.toMatch(/should-not-leak/)
    expect(serialized).not.toMatch(/cause/i)
    expect(serialized).not.toMatch(/location/i)
    expect(serialized).not.toMatch(/pronouncement/i)
  })

  it("does not distinguish a foreign-tenant tag from a missing tag", async () => {
    const { GET } = await import("./route")
    const foreign = await GET(new NextRequest(`https://synapseos.tech/api/mortuary/tag/${BODY_B}`), {
      params: Promise.resolve({ bodyNumber: BODY_B }),
    })
    const missing = await GET(new NextRequest("https://synapseos.tech/api/mortuary/tag/MB-DOES-NOT-EXIST"), {
      params: Promise.resolve({ bodyNumber: "MB-DOES-NOT-EXIST" }),
    })
    const foreignJson = await foreign.json()
    const missingJson = await missing.json()
    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(foreignJson).toEqual(missingJson)
    expect(foreignJson).toEqual({ kind: "mortuary_tag", found: false })
    expect(JSON.stringify(foreignJson)).not.toMatch(/TAG-B-9|other-tenant-phi|44444444/)
  })
})
