import { beforeEach, describe, expect, it, vi } from 'vitest'
import { staffRolePatchSchema } from '../../../../../../lib/hospital-admin/schemas'

type Row = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  ctx: { userId: 'admin-1', email: 'admin@example.test', role: 'hospital_admin', tenantId: 'tenant-1', hospitalId: 'tenant-1', facilityType: 'hospital', fullName: 'Admin' },
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; op: string; values: unknown; filters: Record<string, unknown> }>,
  audit: vi.fn(),
}))

vi.mock('../../../../../../lib/hospital-admin', () => ({
  requireHospitalAdminContext: vi.fn(async () => mocks.ctx),
  isContextError: (x: unknown) => x instanceof Response,
  requireHospitalCapability: vi.fn(async () => null),
  logHospitalAudit: (...a: unknown[]) => mocks.audit(...a),
  staffRolePatchSchema,
}))

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const eqs: Row = {}
      const neqs: Row = {}
      const ins: Record<string, unknown[]> = {}
      let write: { op: string; values: unknown } | null = null
      const match = () =>
        (mocks.tables[table] ?? []).filter(
          (r) =>
            Object.entries(eqs).every(([k, v]) => r[k] === v) &&
            Object.entries(neqs).every(([k, v]) => r[k] !== v) &&
            Object.entries(ins).every(([k, v]) => v.includes(r[k])),
        )
      const record = () => write && mocks.writes.push({ table, op: write.op, values: write.values, filters: { ...eqs } })
      const q: any = {
        then: (res: any, rej: any) => {
          record()
          return Promise.resolve({ data: write ? null : match(), error: null }).then(res, rej)
        },
      }
      q.select = () => q
      q.eq = (k: string, v: unknown) => ((eqs[k] = v), q)
      q.neq = (k: string, v: unknown) => ((neqs[k] = v), q)
      q.in = (k: string, v: unknown[]) => ((ins[k] = v), q)
      q.update = (values: unknown) => ((write = { op: 'update', values }), q)
      const one = async () => {
        if (write) {
          record()
          const hit = match()[0]
          return hit ? { data: { ...hit, ...(write.values as Row) }, error: null } : { data: null, error: { message: 'no rows' } }
        }
        return { data: match()[0] ?? null, error: null }
      }
      q.maybeSingle = one
      q.single = one
      return q
    },
  },
}))

function seed() {
  mocks.tables = {
    profiles: [
      { id: 'admin-1', tenant_id: 'tenant-1', role: 'hospital_admin', email: 'admin@h1.test', is_deleted: false },
      { id: 'admin-2', tenant_id: 'tenant-1', role: 'hospital_admin', email: 'admin2@h1.test', is_deleted: false },
      { id: 'nurse-1', tenant_id: 'tenant-1', role: 'nurse', email: 'nurse@h1.test', is_deleted: false },
      { id: 'doctor-b', tenant_id: 'tenant-2', role: 'doctor', email: 'doc@h2.test', is_deleted: false },
      { id: 'admin-b', tenant_id: 'tenant-2', role: 'hospital_admin', email: 'admin@h2.test', is_deleted: false },
      // Worst cases that share facility A's tenant_id but are not facility staff:
      { id: 'platform-1', tenant_id: 'tenant-1', role: 'platform_admin', email: 'root@p.test', is_deleted: false },
      { id: 'pharm-1', tenant_id: 'tenant-1', role: 'pharmacy_admin', email: 'pa@p.test', is_deleted: false },
      { id: 'patient-1', tenant_id: 'tenant-1', role: 'patient', email: 'pt@p.test', is_deleted: false },
    ],
    departments: [{ id: '11111111-1111-4111-8111-111111111111', tenant_id: 'tenant-1' }],
    staff_scope_assignments: [],
  }
}

async function patch(id: string, body: Record<string, unknown>) {
  const { PATCH } = await import('./route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest(`https://synapse-acceptance-hospital-two.synapseos.tech/api/hospital/admin/staff/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await PATCH(req, { params: Promise.resolve({ id }) })
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.writes = []
  mocks.ctx = { ...mocks.ctx, userId: 'admin-1', role: 'hospital_admin', tenantId: 'tenant-1' }
  seed()
})

describe('PATCH /api/hospital/admin/staff/[id] self-lifecycle protection', () => {
  it.each([
    ['deactivate own assignments', { is_active: false }],
    ['change own role', { role: 'doctor' }],
    ['deactivate and change role together', { is_active: false, role: 'nurse' }],
  ])('refuses to %s, writes nothing, audits the attempt', async (_l, body) => {
    const r = await patch('admin-1', body)
    expect(r.status).toBe(403)
    expect(r.body.error).toMatch(/your own account/)
    expect(mocks.writes).toEqual([])
    expect(mocks.audit).toHaveBeenCalledTimes(1)
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'SELF_LIFECYCLE_BLOCKED', tableName: 'profiles', recordId: 'admin-1' }))
  })

  it('still lets an admin change their own department (tenant-filtered update)', async () => {
    const r = await patch('admin-1', { department_id: '11111111-1111-4111-8111-111111111111' })
    expect(r.status).toBe(200)
    expect(mocks.writes).toContainEqual(expect.objectContaining({
      table: 'profiles', op: 'update', values: { department_id: '11111111-1111-4111-8111-111111111111' },
      filters: { id: 'admin-1', tenant_id: 'tenant-1' },
    }))
  })

  it('still lets an admin deactivate another staff member in the facility', async () => {
    const r = await patch('nurse-1', { is_active: false })
    expect(r.status).toBe(200)
    expect(mocks.writes).toContainEqual(expect.objectContaining({ table: 'staff_scope_assignments', op: 'update', values: expect.objectContaining({ is_active: false }) }))
  })
})

describe('PATCH /api/hospital/admin/staff/[id] cross-facility and target eligibility', () => {
  const bodies: Array<[string, Record<string, unknown>]> = [
    ['role change', { role: 'nurse' }],
    ['deactivate', { is_active: false }],
    ['department move', { department_id: '11111111-1111-4111-8111-111111111111' }],
  ]
  const targets: Array<[string, string]> = [
    ['facility B clinician', 'doctor-b'],
    ['facility B admin', 'admin-b'],
    ['platform admin (even with facility A tenant_id)', 'platform-1'],
    ['pharmacy user', 'pharm-1'],
    ['patient / unrelated user', 'patient-1'],
    ['arbitrary id', '99999999-9999-4999-8999-999999999999'],
  ]
  for (const [tl, tid] of targets) {
    it.each(bodies)(`%s on ${tl} -> 404, no writes`, async (_l, body) => {
      const r = await patch(tid, body)
      expect(r.status).toBe(404)
      expect(mocks.writes).toEqual([])
    })
  }

  it('cannot promote staff to a role outside the facility staff set', async () => {
    const r = await patch('nurse-1', { role: 'platform_admin' })
    expect(r.status).toBe(400)
    expect(mocks.writes).toEqual([])
  })
})

describe('PATCH /api/hospital/admin/staff/[id] last-admin protection', () => {
  it('refuses to demote the last active facility admin (e.g. actor is a platform operator)', async () => {
    mocks.ctx = { ...mocks.ctx, userId: 'platform-op', role: 'platform_admin' }
    mocks.tables.profiles = mocks.tables.profiles.filter((p) => p.id !== 'admin-2')
    const r = await patch('admin-1', { role: 'doctor' })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe('LAST_FACILITY_ADMIN')
    expect(mocks.writes).toEqual([])
  })

  it('refuses to deactivate the last active facility admin', async () => {
    mocks.ctx = { ...mocks.ctx, userId: 'platform-op', role: 'platform_admin' }
    mocks.tables.profiles = mocks.tables.profiles.filter((p) => p.id !== 'admin-2')
    const r = await patch('admin-1', { is_active: false })
    expect(r.status).toBe(409)
    expect(mocks.writes).toEqual([])
  })

  it('allows demoting an admin when another active admin remains', async () => {
    const r = await patch('admin-2', { role: 'doctor' })
    expect(r.status).toBe(200)
  })
})
