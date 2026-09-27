import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Schema-aware mock: selecting a column production does not have fails the way
 * PostgREST does ("column profiles.x does not exist"). Column lists mirror the
 * production schema checked on 2026-09-27.
 */
const COLUMNS: Record<string, string[]> = {
  profiles: ['id', 'email', 'full_name', 'role', 'phone', 'department_id', 'is_deleted', 'created_at', 'last_sign_in_at', 'tenant_id'],
  mfa_enrollments: ['id', 'user_id', 'secret', 'backup_codes', 'verified', 'created_at', 'last_used_at'],
}

const h = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  selects: [] as Array<{ table: string; columns: string }>,
}))

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Array<(r: Record<string, unknown>) => boolean> = []
      let columns = '*'
      const q: any = {
        select(c: string) { columns = c; h.selects.push({ table, columns: c }); return q },
        eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return q },
        neq(k: string, v: unknown) { filters.push((r) => r[k] !== v); return q },
        in(k: string, v: unknown[]) { filters.push((r) => v.includes(r[k])); return q },
        order() { return q },
        then(resolve: (v: unknown) => unknown) {
          const missing = columns.split(',').map((c) => c.trim()).filter((c) => c && c !== '*' && !COLUMNS[table]?.includes(c))
          if (missing.length) return Promise.resolve({ data: null, error: { message: `column ${table}.${missing[0]} does not exist` } }).then(resolve)
          const data = (h.rows[table] ?? []).filter((r) => filters.every((f) => f(r)))
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return q
    },
  },
}))

vi.mock('../../../../../lib/hospital-admin', () => ({
  requireHospitalAdminContext: async () => ({ userId: 'admin-2', tenantId: 'tenant-2', hospitalId: 'tenant-2', role: 'hospital_admin', facilityType: 'hospital' }),
  isContextError: (c: unknown) => c instanceof Response,
  requireHospitalCapability: async () => null,
}))

import { GET } from './route'

describe('GET /api/hospital/admin/staff', () => {
  beforeEach(() => {
    h.selects = []
    h.rows = {
      profiles: [
        { id: 'admin-2', tenant_id: 'tenant-2', role: 'hospital_admin', is_deleted: false, full_name: 'Admin Two' },
        { id: 'nurse-2', tenant_id: 'tenant-2', role: 'nurse', is_deleted: false, full_name: 'Nurse Two' },
        { id: 'patient-2', tenant_id: 'tenant-2', role: 'patient', is_deleted: false },
        { id: 'nurse-1', tenant_id: 'tenant-1', role: 'nurse', is_deleted: false },
      ],
      mfa_enrollments: [
        { user_id: 'admin-2', verified: true },
        { user_id: 'nurse-2', verified: false },
        { user_id: 'nurse-1', verified: true },
      ],
    }
  })

  it('only selects columns production has (no profiles.two_factor_enabled)', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(h.selects.find((s) => s.table === 'profiles')?.columns).not.toContain('two_factor_enabled')
  })

  it('lists own-facility staff with MFA status derived from verified mfa_enrollments', async () => {
    const body = await (await GET()).json()
    expect(body.staff.map((s: { id: string }) => s.id)).toEqual(['admin-2', 'nurse-2'])
    expect(body.staff.find((s: { id: string }) => s.id === 'admin-2').two_factor_enabled).toBe(true)
    expect(body.staff.find((s: { id: string }) => s.id === 'nurse-2').two_factor_enabled).toBe(false)
  })

  it('never selects MFA secrets or backup codes', async () => {
    await GET()
    const mfa = h.selects.find((s) => s.table === 'mfa_enrollments')
    expect(mfa?.columns).toBe('user_id')
  })

  it('reports MFA as unknown (null) rather than failing when the MFA lookup errors', async () => {
    COLUMNS.mfa_enrollments = COLUMNS.mfa_enrollments.filter((c) => c !== 'user_id')
    try {
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.staff.every((s: { two_factor_enabled: unknown }) => s.two_factor_enabled === null)).toBe(true)
    } finally {
      COLUMNS.mfa_enrollments.push('user_id')
    }
  })
})
