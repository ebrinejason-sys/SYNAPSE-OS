/**
 * Hospital admin actor gate (requireHospitalAdminContext), through the real JWT +
 * synapse_sessions validation and account-state rules. Mocked: next/headers and
 * the database client (in-memory PostgREST adapter). All identities synthetic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => {
  process.env.SYNAPSE_JWT_SECRET = 'synthetic-test-secret-for-hospital-gate-0123456789'
  return { token: null as string | null }
})
const state = vi.hoisted(() => ({ db: null as any }))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (env.token && name ? { name, value: env.token } : undefined) }),
  headers: async () => new Headers(),
}))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: (t: string) => state.db.from(t) } }))

import { signToken } from '@synapse/auth/tokens'
import { hashToken } from '@synapse/auth'
import { NextResponse } from 'next/server'
import { createMemoryDb } from '../../test-utils/memory-postgrest'
import { requireHospitalAdminContext } from './context'

const NOW = new Date().toISOString()
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const HOSPITAL = '00000000-0000-4000-8000-0000000000f1'
const LAB = '00000000-0000-4000-8000-0000000000f3'
const PHARMACY = '00000000-0000-4000-8000-0000000000f2'
const ACTOR = '00000000-0000-4000-8000-0000000000c1'

function actor(overrides: Record<string, unknown>) {
  return {
    id: ACTOR, email: 'actor@synthetic.synapse.test', full_name: 'Synthetic Actor', role: 'hospital_admin',
    tenant_id: HOSPITAL, hospital_id: null, is_admin: true, verification_status: 'verified',
    email_verified_at: NOW, is_deleted: false, ...overrides,
  }
}

async function signInAs(profile: Record<string, any>, memberships: Record<string, unknown>[] = []) {
  state.db = createMemoryDb({
    profiles: [profile],
    platform_memberships: memberships,
    synapse_sessions: [],
    tenants: [
      { id: HOSPITAL, facility_type: 'hospital' },
      { id: LAB, facility_type: 'laboratory' },
      { id: PHARMACY, facility_type: 'pharmacy' },
    ],
  })
  const token = await signToken({ sub: profile.id, email: profile.email, role: profile.role, tenant_id: String(profile.tenant_id ?? ''), app: 'web' })
  state.db.tables.synapse_sessions.push({ id: 's1', user_id: profile.id, token_hash: hashToken(token), expires_at: FUTURE, revoked_at: null })
  env.token = token
}

async function gate() {
  const res = await requireHospitalAdminContext()
  if (res instanceof NextResponse) return { status: res.status, body: await res.json() }
  return { status: 200, ctx: res }
}

describe('requireHospitalAdminContext actor gate', () => {
  beforeEach(() => { env.token = null })

  it('hospital_admin of a hospital tenant is admitted with its own tenant', async () => {
    await signInAs(actor({}))
    const r = await gate()
    expect(r.status).toBe(200)
    expect(r.ctx).toMatchObject({ tenantId: HOSPITAL, facilityType: 'hospital', role: 'hospital_admin' })
  })

  it('hospital_admin of a laboratory tenant is admitted', async () => {
    await signInAs(actor({ tenant_id: LAB }))
    expect((await gate()).status).toBe(200)
  })

  it.each([
    ['pharmacy_admin of a pharmacy tenant', actor({ role: 'pharmacy_admin', tenant_id: PHARMACY }), 403],
    ['pharmacist of a pharmacy tenant', actor({ role: 'pharmacist', tenant_id: PHARMACY, is_admin: false }), 403],
    ['hospital_admin whose tenant is a pharmacy', actor({ tenant_id: PHARMACY }), 403],
    ['platform_admin with no tenant', actor({ role: 'platform_admin', tenant_id: null }), 403],
    ['platform_admin carrying a hospital tenant_id', actor({ role: 'platform_admin', tenant_id: HOSPITAL }), 403],
    ['doctor (non-admin hospital staff)', actor({ role: 'doctor', is_admin: false }), 403],
    ['archived hospital_admin with a live session', actor({ is_deleted: true }), 403],
    ['unverified hospital_admin with a live session', actor({ email_verified_at: null }), 403],
    ['hospital_admin with a tenant id that does not exist', actor({ tenant_id: '00000000-0000-4000-8000-0000000000ff' }), 403],
  ])('%s is denied', async (_label, profile, status) => {
    await signInAs(profile)
    const r = await gate()
    expect(r.status).toBe(status)
    expect(r.ctx).toBeUndefined()
  })

  it('hospital_admin suspended via platform membership (verification_status verified) is denied', async () => {
    await signInAs(actor({}), [{ id: 'm1', user_id: ACTOR, platform_role: 'READ_ONLY_OBSERVER', status: 'SUSPENDED', metadata: { account_suspension: { marker: true } } }])
    expect(await gate()).toMatchObject({ status: 403, body: { error: 'Account unavailable' } })
  })

  it('a revoked session is denied', async () => {
    await signInAs(actor({}))
    state.db.tables.synapse_sessions[0].revoked_at = NOW
    expect((await gate()).status).toBe(401)
  })

  it('no session is denied', async () => {
    await signInAs(actor({}))
    env.token = null
    expect((await gate()).status).toBe(401)
  })
})
