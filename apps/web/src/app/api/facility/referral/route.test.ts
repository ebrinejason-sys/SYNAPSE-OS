import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

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

vi.mock('@/lib/hospital-dept', () => ({
  requireHospitalStaffContext: (...args: unknown[]) => requireHospitalStaffContext(...args),
}))

vi.mock('@/lib/hospital-shared', async () => {
  const { NextResponse } = await import('next/server')
  return {
    isContextError: (value: unknown): value is InstanceType<typeof NextResponse> =>
      value instanceof NextResponse,
    requireHospitalCapability: (...args: unknown[]) => requireHospitalCapability(...args),
    gateHospitalModule: (...args: unknown[]) => gateHospitalModule(...args),
    logHospitalAudit: (...args: unknown[]) => logHospitalAudit(...args),
  }
})

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

vi.mock('@synapse/db/clinical-timeline', () => ({
  referralLoopTimelineEvent: vi.fn(() => ({})),
  publishClinicalTimelineBestEffort: vi.fn(async () => null),
}))

vi.mock('@synapse/db/identity-persist', () => ({
  publishTimelineEvent: vi.fn(async () => null),
}))

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const PATIENT = '33333333-3333-4333-8333-333333333333'
const ENCOUNTER = '44444444-4444-4444-8444-444444444444'

function staffCtx() {
  return {
    userId: '55555555-5555-4555-8555-555555555555',
    email: 'doc@example.test',
    role: 'doctor',
    tenantId: TENANT,
    hospitalId: TENANT,
    facilityType: 'hospital',
    fullName: 'Dr Test',
  }
}

function tableMock(handlers: Record<string, { data?: unknown; error?: unknown }>) {
  return (table: string) => {
    const handler = handlers[table] ?? { data: null, error: null }
    const api: Record<string, unknown> = {}
    const self = () => api
    for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) api[method] = vi.fn(self)
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

describe('facility referral route', () => {
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

  it('POST creates a pending referral', async () => {
    dbFrom.mockImplementation(
      tableMock({
        encounters: { data: { id: ENCOUNTER, patient_id: PATIENT } },
        facility_referrals: { data: null, error: null },
      }),
    )
    const { POST } = await import('./route')
    const res = await POST(
      new NextRequest('https://synapseos.tech/api/facility/referral', {
        method: 'POST',
        body: JSON.stringify({
          to_tenant_id: OTHER,
          patient_id: PATIENT,
          encounter_id: ENCOUNTER,
          speciality: 'Surgery',
          clinical_summary: 'Needs theatre',
          urgency: 'URGENT',
          consent_obtained: true,
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.referral.status).toBe('pending')
    expect(body.referral.toTenantId).toBe(OTHER)
  })

  it('POST rejects same-facility referral', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      new NextRequest('https://synapseos.tech/api/facility/referral', {
        method: 'POST',
        body: JSON.stringify({
          to_tenant_id: TENANT,
          patient_id: PATIENT,
          encounter_id: ENCOUNTER,
          speciality: 'Surgery',
          clinical_summary: 'Needs theatre',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(400)
  })
})
