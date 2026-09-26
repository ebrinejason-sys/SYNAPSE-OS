import { beforeEach, describe, expect, it, vi } from 'vitest'
import { staffRolePatchSchema } from '../../../../../../lib/hospital-admin/schemas'

const mocks = vi.hoisted(() => ({
  ctx: { userId: 'admin-1', email: 'admin@example.test', role: 'hospital_admin', tenantId: 'tenant-1', hospitalId: 'tenant-1', facilityType: 'hospital', fullName: 'Admin' },
  target: null as Record<string, unknown> | null,
  writes: [] as Array<{ table: string; op: string; values: unknown }>,
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
      const q: any = { then: (r: any) => Promise.resolve({ data: null, error: null }).then(r) }
      for (const m of ['select', 'eq']) q[m] = vi.fn(() => q)
      q.update = vi.fn((values: unknown) => {
        mocks.writes.push({ table, op: 'update', values })
        return q
      })
      q.maybeSingle = vi.fn(async () => ({ data: table === 'departments' ? { id: 'dept-1' } : mocks.target, error: null }))
      q.single = vi.fn(async () => ({ data: { ...(mocks.target ?? {}) }, error: null }))
      return q
    },
  },
}))

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

describe('PATCH /api/hospital/admin/staff/[id] self-lifecycle protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writes = []
    mocks.target = { id: 'admin-1', email: 'admin@example.test', role: 'hospital_admin', department_id: null, tenant_id: 'tenant-1' }
  })

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
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SELF_LIFECYCLE_BLOCKED',
      tableName: 'profiles',
      recordId: 'admin-1',
    }))
  })

  it('still lets an admin change their own department', async () => {
    const r = await patch('admin-1', { department_id: '11111111-1111-4111-8111-111111111111' })
    expect(r.status).toBe(200)
    expect(mocks.writes).toContainEqual({ table: 'profiles', op: 'update', values: { department_id: '11111111-1111-4111-8111-111111111111' } })
  })

  it('still lets an admin deactivate another staff member', async () => {
    mocks.target = { id: 'nurse-1', email: 'nurse@example.test', role: 'nurse', department_id: null, tenant_id: 'tenant-1' }
    const r = await patch('nurse-1', { is_active: false })
    expect(r.status).toBe(200)
    expect(mocks.writes).toContainEqual({ table: 'staff_scope_assignments', op: 'update', values: expect.objectContaining({ is_active: false }) })
  })
})
