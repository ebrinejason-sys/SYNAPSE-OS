/**
 * Pharmacy API actor gate, end to end through the real session stack:
 * JWT + synapse_sessions validation, getContext account-state rules, pharmacy
 * session mapping and capability resolution. Mocked: next/headers, next/navigation
 * and the database client (in-memory PostgREST adapter). All identities synthetic.
 *
 * Route-level target checks (cross-tenant 404, self-lifecycle, foreign store) are
 * covered in app/api/admin/users/route.test.ts; this file proves WHO gets past the gate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => {
  process.env.SYNAPSE_JWT_SECRET = 'synthetic-test-secret-for-pharmacy-gate-0123456789'
  return { token: null as string | null }
})
const state = vi.hoisted(() => ({ db: null as any }))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (env.token && name ? { name, value: env.token } : undefined) }),
  headers: async () => new Headers(),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`) },
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: (t: string) => state.db.from(t) } }))

import { signToken } from '@synapse/auth/tokens'
import { hashToken } from '@synapse/auth'
import { createMemoryDb } from '../../web/src/test-utils/memory-postgrest'
import { requirePharmacyPermission, requirePharmacyAdmin, requirePlatformAdmin } from './api-auth'
import { requirePharmacySession } from './auth'

const NOW = new Date().toISOString()
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const PHARMACY = '00000000-0000-4000-8000-0000000000f2'
const HOSPITAL = '00000000-0000-4000-8000-0000000000f1'
const LAB = '00000000-0000-4000-8000-0000000000f3'
const ACTOR = '00000000-0000-4000-8000-0000000000e1'

function actor(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTOR, email: 'actor@synthetic.synapse.test', full_name: 'Synthetic Actor', first_name: 'S', last_name: 'A',
    role: 'pharmacy_admin', tenant_id: PHARMACY, synapse_id: null, is_admin: true, onboarding_complete: true,
    must_change_password: false, verification_status: 'verified', email_verified_at: NOW, is_deleted: false,
    ...overrides,
  }
}

async function signInAs(profile: Record<string, any>, extra: { memberships?: Record<string, unknown>[]; settings?: Record<string, unknown>[] } = {}) {
  state.db = createMemoryDb({
    profiles: [profile],
    platform_memberships: extra.memberships ?? [],
    pharmacy_user_settings: extra.settings ?? [],
    synapse_sessions: [],
    tenants: [
      { id: PHARMACY, name: 'Synthetic Pharmacy', slug: 'synthetic-pharmacy', facility_type: 'pharmacy', status: 'active', plan: 'pharmacy_annual', modules_enabled: [] },
      { id: HOSPITAL, name: 'Synthetic Hospital', slug: 'synthetic-hospital', facility_type: 'hospital', status: 'active', plan: 'hospital_starter', modules_enabled: [] },
      { id: LAB, name: 'Synthetic Lab', slug: 'synthetic-lab', facility_type: 'laboratory', status: 'active', plan: 'synapse_lab_annual', modules_enabled: [] },
    ],
  })
  const token = await signToken({ sub: profile.id, email: profile.email, role: profile.role, tenant_id: String(profile.tenant_id ?? ''), app: 'pharmacy' })
  state.db.tables.synapse_sessions.push({ id: 's1', user_id: profile.id, token_hash: hashToken(token), expires_at: FUTURE, revoked_at: null })
  env.token = token
}

async function status(p: Promise<{ ok: boolean; response?: Response; tenantId?: string }>) {
  const r = await p
  return r.ok ? { status: 200, tenantId: r.tenantId } : { status: r.response!.status, body: await r.response!.json() }
}

describe('requirePharmacyPermission / requirePharmacyAdmin actor gate', () => {
  beforeEach(() => { env.token = null })

  it('pharmacy_admin of a pharmacy tenant is admitted for its own tenant', async () => {
    await signInAs(actor())
    expect(await status(requirePharmacyPermission('staff.manage'))).toEqual({ status: 200, tenantId: PHARMACY })
    expect(await status(requirePharmacyAdmin())).toEqual({ status: 200, tenantId: PHARMACY })
  })

  it('a pharmacy cashier lacks staff.manage', async () => {
    await signInAs(actor({ role: 'pharmacy_staff', is_admin: false }), { settings: [{ profile_id: ACTOR, pharmacy_role: 'pharmacy_cashier', permissions: [] }] })
    expect((await status(requirePharmacyPermission('staff.manage'))).status).toBe(403)
    expect((await status(requirePharmacyAdmin())).status).toBe(403)
  })

  it.each([
    ['hospital_admin (is_admin) of a hospital tenant', actor({ role: 'hospital_admin', tenant_id: HOSPITAL })],
    ['hospital_admin (is_admin) of a laboratory tenant', actor({ role: 'hospital_admin', tenant_id: LAB })],
    ['lab_admin of a laboratory tenant', actor({ role: 'lab_admin', tenant_id: LAB })],
    ['hospital pharmacist (role collides with a pharmacy role)', actor({ role: 'pharmacist', tenant_id: HOSPITAL, is_admin: false })],
  ])('%s is denied pharmacy capabilities', async (_label, profile) => {
    await signInAs(profile)
    const r = await status(requirePharmacyPermission('staff.manage'))
    expect(r.status).toBeGreaterThanOrEqual(401)
    expect(r.status).toBeLessThan(404)
    expect((await status(requirePharmacyPermission('pos.sell'))).status).not.toBe(200)
    expect((await status(requirePharmacyAdmin())).status).not.toBe(200)
  })

  it.each([
    ['platform_admin with no tenant', actor({ role: 'platform_admin', tenant_id: null })],
    ['platform_admin carrying a pharmacy tenant_id', actor({ role: 'platform_admin', tenant_id: PHARMACY })],
  ])('%s cannot act as pharmacy staff', async (_label, profile) => {
    await signInAs(profile)
    expect((await status(requirePharmacyPermission('staff.manage'))).status).toBe(403)
    expect((await status(requirePharmacyAdmin())).status).toBe(403)
  })

  it.each([
    ['archived', actor({ is_deleted: true })],
    ['unverified', actor({ email_verified_at: null })],
  ])('%s pharmacy_admin with a live session is unauthenticated', async (_label, profile) => {
    await signInAs(profile)
    expect((await status(requirePharmacyPermission('staff.manage'))).status).toBe(401)
  })

  it('pharmacy_admin suspended via platform membership is unauthenticated', async () => {
    await signInAs(actor(), { memberships: [{ id: 'm1', user_id: ACTOR, platform_role: 'READ_ONLY_OBSERVER', status: 'SUSPENDED', metadata: { account_suspension: { marker: true } } }] })
    expect((await status(requirePharmacyPermission('staff.manage'))).status).toBe(401)
  })

  it('a revoked session is unauthenticated', async () => {
    await signInAs(actor())
    state.db.tables.synapse_sessions[0].revoked_at = NOW
    expect((await status(requirePharmacyPermission('staff.manage'))).status).toBe(401)
  })

  it('an arbitrary patient account is denied', async () => {
    await signInAs(actor({ role: 'patient', tenant_id: null, is_admin: false }))
    expect((await status(requirePharmacyPermission('pos.sell'))).status).not.toBe(200)
  })
})

describe('requirePlatformAdmin (pharmacy cross-tenant tools)', () => {
  beforeEach(() => { env.token = null })

  it('a real platform_admin (no tenant) is admitted', async () => {
    await signInAs(actor({ role: 'platform_admin', tenant_id: null }))
    expect((await requirePlatformAdmin()).ok).toBe(true)
  })

  it('a pharmacy user whose pharmacy_role says platform_admin is denied (profile role decides)', async () => {
    await signInAs(actor({ role: 'pharmacist', is_admin: false }), { settings: [{ profile_id: ACTOR, pharmacy_role: 'platform_admin', permissions: [] }] })
    const r = await requirePlatformAdmin()
    expect(r.ok).toBe(false)
  })

  it('a pharmacy_admin is denied', async () => {
    await signInAs(actor())
    expect((await requirePlatformAdmin()).ok).toBe(false)
  })
})

describe('requirePharmacySession (portal pages)', () => {
  beforeEach(() => { env.token = null })

  it('redirects a hospital_admin away from the pharmacy portal', async () => {
    await signInAs(actor({ role: 'hospital_admin', tenant_id: HOSPITAL }))
    await expect(requirePharmacySession()).rejects.toThrow(/NEXT_REDIRECT \/login\?error=no_pharmacy_access/)
  })

  it('admits pharmacy staff', async () => {
    await signInAs(actor())
    await expect(requirePharmacySession()).resolves.toMatchObject({ tenantId: PHARMACY, facilityType: 'pharmacy' })
  })
})
