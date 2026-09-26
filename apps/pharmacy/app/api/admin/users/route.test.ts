import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  selfRole: 'pharmacy_admin' as string | null,
  writes: [] as Array<{ table: string; op: string; values: any }>,
}))

vi.mock('@/lib/api-auth', () => ({
  requirePharmacyPermission: vi.fn(async () => ({
    ok: true,
    session: { user: { id: 'admin-1' } },
    tenantId: 'tenant-1',
  })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ success: true })), generateWelcomeEmail: vi.fn() }))
vi.mock('@/lib/utils', () => ({ generatePassword: () => 'Temp-Passw0rd!' }))
vi.mock('@synapse/auth/password', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  validatePasswordStrength: () => ({ valid: true, errors: [] }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q: any = { then: (r: any) => Promise.resolve({ data: null, error: null }).then(r) }
      for (const m of ['select', 'eq', 'neq']) q[m] = vi.fn(() => q)
      for (const op of ['update', 'insert', 'delete']) {
        q[op] = vi.fn((values?: unknown) => {
          mocks.writes.push({ table, op, values })
          return q
        })
      }
      q.maybeSingle = vi.fn(async () => ({
        data: table === 'pharmacy_user_settings' ? { pharmacy_role: mocks.selfRole } : null,
        error: null,
      }))
      return q
    },
  },
}))

async function patch(body: Record<string, unknown>) {
  const { PATCH } = await import('./route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest('https://pharm.synapseos.tech/api/admin/users', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await PATCH(req)
  return { status: res.status, body: await res.json() }
}

const nonAuditWrites = () => mocks.writes.filter((w) => w.table !== 'pharmacy_audit_logs')

describe('pharmacy PATCH /api/admin/users self-lifecycle protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writes = []
    mocks.selfRole = 'pharmacy_admin'
  })

  it.each([
    ['deactivate self', { id: 'admin-1', isActive: false }],
    ['demote self to staff', { id: 'admin-1', role: 'STAFF', isActive: true }],
    ['demote self to CEO', { id: 'admin-1', role: 'CEO' }],
  ])('refuses to %s with no state change and an audit entry', async (_l, body) => {
    const r = await patch(body)
    expect(r.status).toBe(403)
    expect(r.body.error).toMatch(/your own account/)
    expect(nonAuditWrites()).toEqual([])
    expect(mocks.writes).toContainEqual({
      table: 'pharmacy_audit_logs',
      op: 'insert',
      values: expect.objectContaining({ action: 'SELF_LIFECYCLE_BLOCKED', entity_id: 'admin-1', profile_id: 'admin-1' }),
    })
  })

  it('still lets an admin rename themselves (edit dialog resends same role and active=true)', async () => {
    const r = await patch({ id: 'admin-1', name: 'New Name', role: 'ADMIN', isActive: true, permissions: [] })
    expect(r.status).toBe(200)
    expect(mocks.writes.some((w) => w.op === 'insert' && w.values?.action === 'SELF_LIFECYCLE_BLOCKED')).toBe(false)
  })

  it('still lets an admin deactivate another user', async () => {
    const r = await patch({ id: 'staff-9', isActive: false })
    expect(r.status).toBe(200)
    expect(mocks.writes).toContainEqual({
      table: 'pharmacy_user_settings',
      op: 'update',
      values: expect.objectContaining({ is_active: false }),
    })
  })
})
