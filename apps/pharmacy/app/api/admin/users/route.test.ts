import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
type Write = { table: string; op: string; values: any; filters: Record<string, unknown> }

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; op: string; values: any; filters: Record<string, unknown> }>,
}))

function seed() {
  mocks.tables = {
    profiles: [
      { id: 'admin-1', tenant_id: 'tenant-1', role: 'pharmacy_admin', email: 'admin1@a.test', full_name: 'Admin A' },
      { id: 'staff-9', tenant_id: 'tenant-1', role: 'pharmacy_staff', email: 'staff9@a.test', full_name: 'Staff A' },
      // Tenant B pharmacy admin — must be invisible to tenant A.
      { id: 'victim-b', tenant_id: 'tenant-2', role: 'pharmacy_admin', email: 'victim@b.test', full_name: 'Admin B' },
      // Platform admin with no pharmacy settings anywhere.
      { id: 'platform-1', tenant_id: null, role: 'platform_admin', email: 'root@platform.test', full_name: 'Root' },
      // Platform admin that (worst case) carries tenant A's tenant_id and a settings row.
      { id: 'platform-2', tenant_id: 'tenant-1', role: 'platform_admin', email: 'root2@platform.test', full_name: 'Root 2' },
      // Hospital clinician that somehow shares tenant A's id + settings row: outside pharmacy staff scope.
      { id: 'doctor-1', tenant_id: 'tenant-1', role: 'doctor', email: 'doc@a.test', full_name: 'Doc' },
      // Hospital facility admin in another (hospital) tenant.
      { id: 'hosp-admin-h', tenant_id: 'tenant-h', role: 'hospital_admin', email: 'admin@h.test', full_name: 'Hosp Admin' },
    ],
    pharmacy_user_settings: [
      { tenant_id: 'tenant-1', profile_id: 'admin-1', pharmacy_role: 'pharmacy_admin' },
      { tenant_id: 'tenant-1', profile_id: 'staff-9', pharmacy_role: 'pharmacy_staff' },
      { tenant_id: 'tenant-2', profile_id: 'victim-b', pharmacy_role: 'pharmacy_admin' },
      { tenant_id: 'tenant-1', profile_id: 'platform-2', pharmacy_role: 'pharmacy_admin' },
      { tenant_id: 'tenant-1', profile_id: 'doctor-1', pharmacy_role: 'pharmacy_staff' },
    ],
    pharmacy_stores: [
      { id: 'store-1', tenant_id: 'tenant-1' },
      { id: 'store-b', tenant_id: 'tenant-2' },
    ],
  }
}

vi.mock('@/lib/api-auth', () => ({
  requirePharmacyPermission: vi.fn(async () => ({
    ok: true,
    session: { user: { id: 'admin-1' } },
    tenantId: 'tenant-1',
  })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ success: true })), generateWelcomeEmail: vi.fn(() => '') }))
vi.mock('@/lib/utils', () => ({ generatePassword: () => 'Temp-Passw0rd!' }))
vi.mock('@synapse/auth/password', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  validatePasswordStrength: () => ({ valid: true, errors: [] }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const eqs: Record<string, unknown> = {}
      const neqs: Record<string, unknown> = {}
      let write: { op: string; values: unknown } | null = null
      const match = () =>
        (mocks.tables[table] ?? []).filter(
          (r) =>
            Object.entries(eqs).every(([k, v]) => r[k] === v) &&
            Object.entries(neqs).every(([k, v]) => r[k] !== v),
        )
      const q: any = {
        then: (res: any, rej: any) => {
          if (write) mocks.writes.push({ table, op: write.op, values: write.values, filters: { ...eqs } })
          return Promise.resolve({ data: write ? null : match(), error: null }).then(res, rej)
        },
      }
      q.select = vi.fn(() => q)
      q.order = vi.fn(() => q)
      q.in = vi.fn(() => q)
      q.eq = vi.fn((k: string, v: unknown) => ((eqs[k] = v), q))
      q.neq = vi.fn((k: string, v: unknown) => ((neqs[k] = v), q))
      for (const op of ['update', 'insert', 'delete']) {
        q[op] = vi.fn((values?: unknown) => ((write = { op, values }), q))
      }
      const one = async () => {
        if (write) {
          mocks.writes.push({ table, op: write.op, values: write.values, filters: { ...eqs } })
          return { data: { id: (write.values as Row)?.id ?? null }, error: null }
        }
        return { data: match()[0] ?? null, error: null }
      }
      q.maybeSingle = vi.fn(one)
      q.single = vi.fn(one)
      return q
    },
  },
}))

async function call(method: 'PATCH' | 'DELETE' | 'POST', body?: Record<string, unknown>, query = '') {
  const route = await import('./route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest(`https://pharm.synapseos.tech/api/admin/users${query}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const res = await (route as any)[method](req)
  return { status: res.status, body: await res.json() }
}
const patch = (body: Record<string, unknown>) => call('PATCH', body)

const nonAuditWrites = () => mocks.writes.filter((w) => w.table !== 'pharmacy_audit_logs')
const writesTo = (table: string) => mocks.writes.filter((w) => w.table === table)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.writes = []
  seed()
})

describe('pharmacy PATCH /api/admin/users self-lifecycle protection', () => {
  it.each([
    ['deactivate self', { id: 'admin-1', isActive: false }],
    ['demote self to staff', { id: 'admin-1', role: 'STAFF', isActive: true }],
    ['demote self to CEO', { id: 'admin-1', role: 'CEO' }],
  ])('refuses to %s with no state change and an audit entry', async (_l, body) => {
    const r = await patch(body)
    expect(r.status).toBe(403)
    expect(r.body.error).toMatch(/your own account/)
    expect(nonAuditWrites()).toEqual([])
    expect(mocks.writes).toContainEqual(
      expect.objectContaining({
        table: 'pharmacy_audit_logs',
        op: 'insert',
        values: expect.objectContaining({ action: 'SELF_LIFECYCLE_BLOCKED', entity_id: 'admin-1', profile_id: 'admin-1' }),
      }),
    )
  })

  it('still lets an admin rename themselves (edit dialog resends same role and active=true)', async () => {
    const r = await patch({ id: 'admin-1', name: 'New Name', role: 'ADMIN', isActive: true, permissions: [] })
    expect(r.status).toBe(200)
    expect(mocks.writes.some((w) => w.op === 'insert' && w.values?.action === 'SELF_LIFECYCLE_BLOCKED')).toBe(false)
  })

  it('still lets an admin deactivate another user in the same tenant', async () => {
    const r = await patch({ id: 'staff-9', isActive: false })
    expect(r.status).toBe(200)
    expect(writesTo('pharmacy_user_settings')).toContainEqual(
      expect.objectContaining({ op: 'update', values: expect.objectContaining({ is_active: false }) }),
    )
  })
})

// D6 — cross-tenant / out-of-scope account takeover via by-id-only writes.
const WRITE_PATHS: Array<[string, Record<string, unknown>]> = [
  ['set-password', { password: 'Attacker-Chosen-Passw0rd!' }],
  ['reset-password', { resetPassword: true }],
  ['rename', { name: 'Pwned' }],
  ['username', { username: 'pwned' }],
  ['role', { role: 'STAFF' }],
  ['permissions', { permissions: ['MANAGE_USERS'] }],
  ['deactivate', { isActive: false }],
  ['combined edit', { name: 'Pwned', role: 'ADMIN', isActive: true, permissions: [] }],
]
const OUT_OF_SCOPE_TARGETS: Array<[string, string]> = [
  ['tenant B pharmacy admin', 'victim-b'],
  ['platform_admin (no tenant)', 'platform-1'],
  ['platform_admin carrying tenant A id + settings', 'platform-2'],
  ['non-pharmacy role in tenant A', 'doctor-1'],
  ['hospital admin in a hospital tenant', 'hosp-admin-h'],
  ['unknown id', 'does-not-exist'],
]

describe('D6: pharmacy PATCH /api/admin/users refuses targets outside caller tenant/staff scope', () => {
  for (const [targetLabel, targetId] of OUT_OF_SCOPE_TARGETS) {
    it.each(WRITE_PATHS)(`%s on ${targetLabel} -> 404, no writes, no email`, async (_l, body) => {
      const { sendEmail } = await import('@/lib/email')
      const r = await patch({ id: targetId, ...body })
      expect(r.status).toBe(404)
      expect(r.body.error).toBe('User not found')
      expect(mocks.writes).toEqual([])
      expect(sendEmail).not.toHaveBeenCalled()
    })
  }

  it('rejects assigning a role outside pharmacy staff scope', async () => {
    const r = await patch({ id: 'staff-9', role: 'platform_admin' })
    expect(r.status).toBe(400)
    expect(mocks.writes).toEqual([])
  })

  it('same-tenant set-password still works and the profile update is tenant-filtered', async () => {
    const r = await patch({ id: 'staff-9', password: 'New-Strong-Passw0rd!' })
    expect(r.status).toBe(200)
    const profileWrites = writesTo('profiles')
    expect(profileWrites).toHaveLength(1)
    expect(profileWrites[0].filters).toEqual({ id: 'staff-9', tenant_id: 'tenant-1' })
  })

  it('same-tenant reset-password emails the tenant user and tenant-filters the update', async () => {
    const { sendEmail } = await import('@/lib/email')
    const r = await patch({ id: 'staff-9', resetPassword: true })
    expect(r.status).toBe(200)
    expect(writesTo('profiles')[0].filters).toEqual({ id: 'staff-9', tenant_id: 'tenant-1' })
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'staff9@a.test' }))
  })

  it('same-tenant rename tenant-filters the profile update', async () => {
    const r = await patch({ id: 'staff-9', name: 'Renamed' })
    expect(r.status).toBe(200)
    expect(writesTo('profiles')[0].filters).toEqual({ id: 'staff-9', tenant_id: 'tenant-1' })
  })
})

describe('D6 siblings: DELETE and POST /api/admin/users', () => {
  it.each(OUT_OF_SCOPE_TARGETS)('DELETE %s -> 404 with no writes', async (_l, targetId) => {
    const r = await call('DELETE', undefined, `?id=${targetId}`)
    expect(r.status).toBe(404)
    expect(mocks.writes).toEqual([])
  })

  it('DELETE same-tenant staff soft-deletes with a tenant-filtered profile update', async () => {
    const r = await call('DELETE', undefined, '?id=staff-9')
    expect(r.status).toBe(200)
    const profileWrites = writesTo('profiles')
    expect(profileWrites).toHaveLength(1)
    expect(profileWrites[0].filters).toEqual({ id: 'staff-9', tenant_id: 'tenant-1' })
  })

  it("POST refuses a storeId that belongs to another tenant", async () => {
    const r = await call('POST', { name: 'New', email: 'new@a.test', role: 'STAFF', storeId: 'store-b' })
    expect(r.status).toBe(400)
    expect(mocks.writes).toEqual([])
  })

  it('POST accepts a storeId from the caller tenant', async () => {
    const r = await call('POST', { name: 'New', email: 'new@a.test', role: 'STAFF', storeId: 'store-1', sendWelcomeEmail: false })
    expect(r.status).toBe(200)
    expect(writesTo('profiles')[0].values).toEqual(expect.objectContaining({ tenant_id: 'tenant-1' }))
  })
})

describe('D6 hardening: direct invocation and tampered tenant identifiers', () => {
  it('unauthenticated/unauthorised direct invocation is refused by the actor gate before any lookup', async () => {
    const { requirePharmacyPermission } = await import('@/lib/api-auth')
    const { NextResponse } = await import('next/server')
    ;(requirePharmacyPermission as any).mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const r = await patch({ id: 'staff-9', password: 'X-Strong-Passw0rd!' })
    expect(r.status).toBe(401)
    expect(mocks.writes).toEqual([])
  })

  it.each([
    ['tenantId', { tenantId: 'tenant-2' }],
    ['pharmacyId', { pharmacyId: 'tenant-2' }],
    ['tenant_id', { tenant_id: 'tenant-2' }],
    ['storeId', { storeId: 'store-b' }],
  ])('a tampered %s in the body cannot move the target into scope', async (_l, extra) => {
    const r = await patch({ id: 'victim-b', password: 'X-Strong-Passw0rd!', ...extra })
    expect(r.status).toBe(404)
    expect(mocks.writes).toEqual([])
  })

  it('a tampered tenantId query parameter on DELETE is ignored', async () => {
    const r = await call('DELETE', undefined, '?id=victim-b&tenantId=tenant-2')
    expect(r.status).toBe(404)
    expect(mocks.writes).toEqual([])
  })

  it('A-admin -> A-staff is still allowed end to end (tenant from session only)', async () => {
    const r = await patch({ id: 'staff-9', password: 'X-Strong-Passw0rd!', tenantId: 'tenant-2' })
    expect(r.status).toBe(200)
    expect(writesTo('profiles')[0].filters).toEqual({ id: 'staff-9', tenant_id: 'tenant-1' })
  })
})

