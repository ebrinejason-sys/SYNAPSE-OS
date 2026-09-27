/**
 * Restore authorization, end to end through the real auth stack.
 *
 * Real: JWT verification, synapse_sessions validation, account-state gating
 * (archived / suspended actors), platform membership resolution, RBAC
 * capability check (user.reactivate), identity lifecycle guard, profile update
 * and the audit_log write. Mocked: Next.js request primitives (cookies,
 * headers, redirect, revalidatePath) and the database client, which is an
 * in-memory PostgREST adapter. All identities are synthetic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => {
  process.env.SYNAPSE_JWT_SECRET = 'synthetic-test-secret-for-restore-authz-0123456789'
  process.env.ADMIN_EMAILS = ''
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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: { from: (t: string) => state.db.from(t), rpc: (...a: unknown[]) => state.db.rpc(...a) },
}))
// platform-data imports this module by relative path; mock the resolved file.
vi.mock('../../../lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (t: string) => state.db.from(t) }),
  createClient: async () => ({ from: (t: string) => state.db.from(t) }),
}))
vi.mock('@/lib/auth/password-reset.server', () => ({ sendUserPasswordReset: vi.fn() }))
// Root vitest has no `@/` alias: map the specifier to the REAL platform auth module (not a stub).
vi.mock('@/lib/platform/auth', async () => await import('../../../lib/platform/auth'))

import { signToken } from '@synapse/auth/tokens'
import { hashToken } from '@synapse/auth'
import { roleHasCapability } from '../../../lib/platform/rbac'
import { createMemoryDb } from '../../../test-utils/memory-postgrest'
import { restoreUserAccount } from './actions'
import { searchPlatformUsers } from '../../../lib/platform/user-directory'

const NOW = new Date().toISOString()
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const TARGET = '00000000-0000-4000-8000-00000000000a'
const ACTOR = '00000000-0000-4000-8000-00000000000b'
const HOSPITAL_TENANT = '00000000-0000-4000-8000-0000000000f1'
const PHARMACY_TENANT = '00000000-0000-4000-8000-0000000000f2'

type ProfileSeed = Record<string, unknown>

function profile(id: string, overrides: ProfileSeed = {}): ProfileSeed {
  return {
    id,
    email: `${id.slice(-4)}@synthetic.synapse.test`,
    full_name: `Synthetic ${id.slice(-4)}`,
    role: 'platform_admin',
    tenant_id: null,
    verification_status: 'verified',
    email_verified_at: NOW,
    is_deleted: false,
    must_change_password: false,
    created_at: NOW,
    ...overrides,
  }
}

function seed(actor: ProfileSeed, actorMembership: Record<string, unknown> | null) {
  const memberships = [
    // Target: archived platform admin whose membership, MFA and password-change flag must survive restore.
    { id: 'm-target', user_id: TARGET, platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE', expires_at: null, mfa_required: true, password_change_required: true },
  ]
  if (actorMembership) memberships.push({ id: 'm-actor', user_id: ACTOR, expires_at: null, mfa_required: true, password_change_required: false, ...actorMembership } as any)
  state.db = createMemoryDb({
    profiles: [
      actor,
      profile(TARGET, { is_deleted: true, must_change_password: true, verification_status: 'verified' }),
      // A second active platform admin so lifecycle guards never see a "last admin" condition.
      profile('00000000-0000-4000-8000-00000000000c'),
    ],
    platform_memberships: memberships,
    mfa_enrollments: [{ id: 'mfa-target', user_id: TARGET, verified: true, secret: 'synthetic-not-a-secret', backup_codes: [] }],
    synapse_sessions: [],
    audit_log: [],
    // Tenants for the tenant-role actors, so their session context resolves and the
    // denial is proven at the platform access layer rather than by a missing tenant.
    tenants: [
      { id: HOSPITAL_TENANT, name: 'Synthetic Hospital', slug: 'synthetic-hospital', facility_type: 'hospital', status: 'active', plan: 'hospital_starter', modules_enabled: [] },
      { id: PHARMACY_TENANT, name: 'Synthetic Pharmacy', slug: 'synthetic-pharmacy', facility_type: 'pharmacy', status: 'active', plan: 'pharmacy_starter', modules_enabled: [] },
    ],
  })
}

async function signIn(actor: ProfileSeed) {
  const token = await signToken({
    sub: String(actor.id), email: String(actor.email), role: String(actor.role),
    tenant_id: String(actor.tenant_id ?? ''), app: 'web',
  })
  state.db.tables.synapse_sessions.push({ id: `s-${actor.id}`, user_id: actor.id, token_hash: hashToken(token), expires_at: FUTURE, revoked_at: null })
  env.token = token
}

function form(userId: string) {
  const fd = new FormData()
  fd.set('user_id', userId)
  return fd
}

const target = () => state.db.tables.profiles.find((p: any) => p.id === TARGET)
const restoreAudits = () => state.db.tables.audit_log.filter((a: any) => a.action === 'user.restored')
const profileWrites = () => state.db.log.filter((l: any) => l.table === 'profiles' && l.op === 'update')

function expectDeniedWithoutEffects() {
  expect(target().is_deleted).toBe(true)
  expect(profileWrites()).toEqual([])
  expect(restoreAudits()).toEqual([])
}

describe('restoreUserAccount authorization (real auth stack, in-memory DB)', () => {
  beforeEach(() => { env.token = null })

  it('1. PLATFORM_ADMIN restores an archived PLATFORM_ADMIN: archive cleared, audit written, access state preserved', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    await signIn(actor)

    const result = await restoreUserAccount(form(TARGET))
    expect(result).toEqual({ ok: true })

    const t = target()
    expect(t.is_deleted).toBe(false)
    expect(t.verification_status).toBe('verified')
    expect(t.role).toBe('platform_admin')
    expect(t.must_change_password).toBe(true)
    expect(t.email_verified_at).toBe(NOW)

    const membership = state.db.tables.platform_memberships.find((m: any) => m.user_id === TARGET)
    expect(membership).toMatchObject({ platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE', mfa_required: true, password_change_required: true })
    expect(state.db.tables.mfa_enrollments).toEqual([expect.objectContaining({ user_id: TARGET, verified: true })])
    // Restore does not mint a session for the target: they must sign in (password + MFA) again.
    expect(state.db.tables.synapse_sessions.filter((s: any) => s.user_id === TARGET)).toEqual([])

    const audits = restoreAudits()
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      table_name: 'profile',
      record_id: TARGET,
      user_id: ACTOR,
      old_value: { is_deleted: true, verification_status: 'verified' },
      new_value: expect.objectContaining({ role: 'platform_admin', is_deleted: false }),
    })
  })

  it('2. a platform role without user.reactivate (SUPPORT_ADMIN, has user.read) is denied', async () => {
    expect(roleHasCapability('SUPPORT_ADMIN', 'user.read')).toBe(true)
    expect(roleHasCapability('SUPPORT_ADMIN', 'user.reactivate')).toBe(false)
    const actor = profile(ACTOR, { role: 'staff' })
    seed(actor, { platform_role: 'SUPPORT_ADMIN', status: 'ACTIVE' })
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\?error=forbidden/)
    expectDeniedWithoutEffects()
  })

  it('3. hospital_admin (tenant role, no platform membership) is denied', async () => {
    const actor = profile(ACTOR, { role: 'hospital_admin', tenant_id: HOSPITAL_TENANT })
    seed(actor, null)
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login\?error=unauthorized/)
    expectDeniedWithoutEffects()
  })

  it('4. pharmacy_admin (tenant role, no platform membership) is denied', async () => {
    const actor = profile(ACTOR, { role: 'pharmacy_admin', tenant_id: PHARMACY_TENANT })
    seed(actor, null)
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login\?error=unauthorized/)
    expectDeniedWithoutEffects()
  })

  it('5. an archived actor holding a still-valid session and ACTIVE PLATFORM_ADMIN membership is denied', async () => {
    const actor = profile(ACTOR, { is_deleted: true })
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login/)
    expectDeniedWithoutEffects()
  })

  it('6. a suspended actor holding a still-valid session and ACTIVE PLATFORM_ADMIN membership is denied', async () => {
    const actor = profile(ACTOR, { verification_status: 'suspended' })
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login/)
    expectDeniedWithoutEffects()
  })

  it('6b. an actor whose platform membership is SUSPENDED is denied (no legacy fallback)', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'SUSPENDED' })
    await signIn(actor)

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform/)
    expectDeniedWithoutEffects()
  })

  it('7. an unauthenticated request is denied', async () => {
    seed(profile(ACTOR), { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    env.token = null

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login/)
    expectDeniedWithoutEffects()
  })

  it('7b. a revoked session is denied', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    await signIn(actor)
    state.db.tables.synapse_sessions[0].revoked_at = NOW

    await expect(restoreUserAccount(form(TARGET))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login/)
    expectDeniedWithoutEffects()
  })
})

describe('restoreUserAccount state handling', () => {
  beforeEach(() => { env.token = null })

  it('preserves a pending professional verification instead of forcing verified', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    Object.assign(target(), { role: 'doctor', verification_status: 'pending', tenant_id: '00000000-0000-4000-8000-0000000000f1' })
    await signIn(actor)

    expect(await restoreUserAccount(form(TARGET))).toEqual({ ok: true })
    expect(target()).toMatchObject({ is_deleted: false, verification_status: 'pending' })
    expect(restoreAudits()[0]).toMatchObject({ old_value: { is_deleted: true, verification_status: 'pending' } })
  })

  it('lifts a suspension marker on an archived identity so the restored user can sign in', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    Object.assign(target(), { verification_status: 'suspended' })
    await signIn(actor)

    expect(await restoreUserAccount(form(TARGET))).toEqual({ ok: true })
    expect(target()).toMatchObject({ is_deleted: false, verification_status: 'verified' })
  })

  it('refuses to restore an identity that is neither archived nor suspended', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    Object.assign(target(), { is_deleted: false })
    await signIn(actor)

    const result = await restoreUserAccount(form(TARGET))
    expect(result.ok).toBe(false)
    expect(profileWrites()).toEqual([])
    expect(restoreAudits()).toEqual([])
  })
})

describe('archived account beyond the first page: find, then restore', () => {
  beforeEach(() => { env.token = null })

  it('an old archived platform admin outside the first 200 profiles is found via the Archived filter and search, then restored', async () => {
    const actor = profile(ACTOR)
    seed(actor, { platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE' })
    // Make the target the oldest profile and bury it under 250 newer synthetic profiles.
    Object.assign(target(), { created_at: '2025-01-01T00:00:00Z', email: 'synthetic-platform-admin-a@synapse.test' })
    for (let i = 0; i < 250; i++) {
      state.db.tables.profiles.push(profile(`10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, {
        role: 'doctor', tenant_id: HOSPITAL_TENANT, created_at: new Date(Date.parse('2026-01-01T00:00:00Z') + i * 60_000).toISOString(),
      }))
    }
    // Premise: the previous page query (created_at desc, limit 200) could not see it.
    const oldWindow = [...state.db.tables.profiles].sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200)
    expect(oldWindow.some((r: any) => r.id === TARGET)).toBe(false)

    const byStatus = await searchPlatformUsers(state.db, { status: 'archived' })
    expect(byStatus.rows.map(r => r.id)).toEqual([TARGET])
    const bySearch = await searchPlatformUsers(state.db, { q: 'platform-admin-a' })
    expect(bySearch.rows.map(r => r.id)).toEqual([TARGET])

    await signIn(actor)
    expect(await restoreUserAccount(form(String(byStatus.rows[0].id)))).toEqual({ ok: true })
    expect(target().is_deleted).toBe(false)
    expect(restoreAudits()).toHaveLength(1)
    expect((await searchPlatformUsers(state.db, { status: 'archived' })).total).toBe(0)
    expect((await searchPlatformUsers(state.db, { status: 'active', q: 'platform-admin-a' })).rows.map(r => r.id)).toEqual([TARGET])
  })
})
