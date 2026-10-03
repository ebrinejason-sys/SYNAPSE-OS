import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Synthetic tenants/profiles only.
const h = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; op: string; row: Record<string, unknown> }>,
  audits: [] as unknown[],
  capDenied: false,
}))

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Array<(r: Record<string, unknown>) => boolean> = []
      const result = () => (h.rows[table] ?? []).filter((r) => filters.every((f) => f(r)))
      const q: any = {
        select() { return q },
        eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return q },
        order() { return q },
        maybeSingle() { return Promise.resolve({ data: result()[0] ?? null, error: null }) },
        upsert(row: Record<string, unknown>) { h.writes.push({ table, op: 'upsert', row }); return Promise.resolve({ error: null }) },
        update(row: Record<string, unknown>) { h.writes.push({ table, op: 'update', row }); return q },
        insert(row: Record<string, unknown>) { h.writes.push({ table, op: 'insert', row }); return q },
        then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: result(), error: null }).then(resolve) },
      }
      return q
    },
  },
}))

vi.mock('../../../../../lib/hospital-admin', () => ({
  requireHospitalAdminContext: async () => ({ userId: 'admin-2', tenantId: 'tenant-2', hospitalId: 'tenant-2', role: 'hospital_admin', facilityType: 'hospital' }),
  isContextError: (c: unknown) => c instanceof Response,
  requireHospitalCapability: async () => (h.capDenied ? Response.json({ error: 'Forbidden' }, { status: 403 }) : null),
  logHospitalAudit: async (a: unknown) => { h.audits.push(a) },
}))
vi.mock('../../../../../../lib/hospital-admin', () => ({
  requireHospitalAdminContext: async () => ({ userId: 'admin-2', tenantId: 'tenant-2', hospitalId: 'tenant-2', role: 'hospital_admin', facilityType: 'hospital' }),
  isContextError: (c: unknown) => c instanceof Response,
  requireHospitalCapability: async () => (h.capDenied ? Response.json({ error: 'Forbidden' }, { status: 403 }) : null),
  logHospitalAudit: async (a: unknown) => { h.audits.push(a) },
}))

import { GET } from './route'
import { PATCH } from './[id]/route'

const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(`http://localhost/api/hospital/admin/payroll/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })

describe('hospital admin payroll routes', () => {
  beforeEach(() => {
    h.writes = []
    h.audits = []
    h.capDenied = false
    h.rows = {
      profiles: [
        { id: 'nurse-2', tenant_id: 'tenant-2', role: 'nurse', is_deleted: false, full_name: 'Nurse Two', department_id: 'dep-2' },
        { id: 'patient-2', tenant_id: 'tenant-2', role: 'patient', is_deleted: false },
        { id: 'platform-2', tenant_id: 'tenant-2', role: 'platform_admin', is_deleted: false },
        { id: 'nurse-1', tenant_id: 'tenant-1', role: 'nurse', is_deleted: false },
      ],
      departments: [{ id: 'dep-2', tenant_id: 'tenant-2', name: 'Ward A' }],
      staff_compensation: [
        { profile_id: 'nurse-2', tenant_id: 'tenant-2', base_salary_ugx: '1500000.00' },
        { profile_id: 'nurse-1', tenant_id: 'tenant-1', base_salary_ugx: '9' },
      ],
    }
  })

  it('lists only own-facility staff roles with salary and department', async () => {
    const body = await (await GET()).json()
    expect(body.staff).toEqual([{ id: 'nurse-2', full_name: 'Nurse Two', role: 'nurse', department: 'Ward A', base_salary_ugx: 1500000 }])
  })

  it('requires the staff capability', async () => {
    h.capDenied = true
    expect((await GET()).status).toBe(403)
    expect((await patch('nurse-2', { base_salary_ugx: 1 })).status).toBe(403)
    expect(h.writes).toEqual([])
  })

  it('writes salary to staff_compensation, never to profiles, and audits it', async () => {
    const res = await patch('nurse-2', { base_salary_ugx: 2000000 })
    expect(res.status).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ table: 'staff_compensation', op: 'upsert', row: { profile_id: 'nurse-2', tenant_id: 'tenant-2', base_salary_ugx: 2000000, updated_by: 'admin-2' } })
    expect(h.writes.some((w) => w.table === 'profiles')).toBe(false)
    expect(h.audits).toHaveLength(1)
  })

  it('answers 404 for other tenants, patients and platform operators', async () => {
    for (const id of ['nurse-1', 'patient-2', 'platform-2', 'missing']) {
      expect((await patch(id, { base_salary_ugx: 1 })).status).toBe(404)
    }
    expect(h.writes).toEqual([])
  })

  it('rejects negative, non-numeric and extra fields (no privileged column smuggling)', async () => {
    for (const body of [{ base_salary_ugx: -1 }, { base_salary_ugx: 'x' }, { base_salary_ugx: 1, role: 'platform_admin' }, null]) {
      expect((await patch('nurse-2', body)).status).toBe(400)
    }
    expect(h.writes).toEqual([])
  })
})
