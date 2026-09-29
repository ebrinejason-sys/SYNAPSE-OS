/**
 * Suspend / unsuspend, end to end through the real auth stack, without writing
 * 'suspended' into profiles.verification_status (production CHECK allows only
 * pending, under_review, verified, rejected).
 *
 * Suspension is a SUSPENDED platform_memberships row: the user's own membership
 * rows are flipped to SUSPENDED, or, for a user with no control-plane membership,
 * a no-access marker row is inserted. Real: JWT + synapse_sessions validation,
 * platform membership / RBAC (user.suspend, user.reactivate), lifecycle guards,
 * the password-login route, createSession backstop, user directory filters and
 * Platform Access listing. Mocked: Next.js primitives, OTP email delivery and the
 * database client (in-memory PostgREST adapter). All identities are synthetic.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => {
  process.env.SYNAPSE_JWT_SECRET = 'synthetic-test-secret-for-suspend-lifecycle-0123456789'
  process.env.ADMIN_EMAILS = ''
  return { token: null as string | null }
})
const state = vi.hoisted(() => ({ db: null as any, sentOtps: 0 }))

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
  supabaseAdmin: { from: (t: string) => state.db.from(t), rpc: (...a: unknown[]) => state.db.rpc?.(...a) ?? { data: null, error: null } },
}))
vi.mock('../../../lib/supabase/server', () => ({
  createServiceClient: () => ({ from: (t: string) => state.db.from(t) }),
  createClient: async () => ({ from: (t: string) => state.db.from(t) }),
}))
vi.mock('../../../lib/resend', () => ({ sendOtpEmail: vi.fn(async () => { state.sentOtps++ }) }))
vi.mock('@/lib/auth/password-reset.server', () => ({ sendUserPasswordReset: vi.fn() }))
vi.mock('@/lib/platform/auth', async () => await import('../../../lib/platform/auth'))

import { signToken } from '@synapse/auth/tokens'
import { hashToken, hashPassword, createSession, AccountSuspendedError, ACCOUNT_UNAVAILABLE_ERROR } from '@synapse/auth'
import { createMemoryDb } from '../../../test-utils/memory-postgrest'
import { reactivateUserAccount, restoreUserAccount, suspendUserAccount } from './actions'
import { searchPlatformUsers } from '../../../lib/platform/user-directory'
import { listPlatformMembers } from '../../../lib/platform/membership.server'
import { roleHasCapability } from '../../../lib/platform/rbac'
import { POST as passwordLogin } from '../../api/auth/password-login/route'

const NOW = new Date().toISOString()
const FUTURE = new Date(Date.now() + 3600_000).toISOString()
const ACTOR = '00000000-0000-4000-8000-0000000000a1'
const DOCTOR = '00000000-0000-4000-8000-0000000000d1'
const SUPPORT = '00000000-0000-4000-8000-0000000000s1'.replace('s', '5')
const OTHER_ADMIN = '00000000-0000-4000-8000-0000000000a2'
const TENANT = '00000000-0000-4000-8000-0000000000f1'
const PASSWORD = 'synthetic-Passw0rd!'
let passwordHash = ''

function profile(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, email: `${id.slice(-4)}@synthetic.synapse.test`, full_name: `Synthetic ${id.slice(-4)}`,
    role: 'platform_admin', tenant_id: null, verification_status: 'verified', email_verified_at: NOW,
    is_deleted: false, must_change_password: false, password_hash: passwordHash, login_attempts: 0,
    locked_until: null, created_at: NOW, ...overrides,
  }
}

function seed(actorRole = 'PLATFORM_ADMIN') {
  state.db = createMemoryDb({
    profiles: [
      profile(ACTOR, actorRole === 'PLATFORM_ADMIN' ? {} : { role: 'staff' }),
      profile(OTHER_ADMIN),
      profile(DOCTOR, { role: 'doctor', tenant_id: TENANT, verification_status: 'verified' }),
      profile(SUPPORT, { role: 'staff' }),
    ],
    platform_memberships: [
      { id: 'm-actor', user_id: ACTOR, platform_role: actorRole, status: 'ACTIVE', expires_at: null, mfa_required: false, password_change_required: false, metadata: {} },
      { id: 'm-other', user_id: OTHER_ADMIN, platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE', expires_at: null, mfa_required: false, password_change_required: false, metadata: {} },
      { id: 'm-support', user_id: SUPPORT, platform_role: 'SUPPORT_ADMIN', status: 'ACTIVE', expires_at: null, mfa_required: false, password_change_required: false, metadata: { invited_note: 'keep' } },
    ],
    mfa_enrollments: [],
    synapse_sessions: [],
    audit_log: [],
    auth_otps: [],
    tenants: [{ id: TENANT, name: 'Synthetic Hospital', slug: 'synthetic-hospital', facility_type: 'hospital', status: 'active', plan: 'hospital_starter', modules_enabled: [] }],
  })
}

async function sessionFor(p: { id: string; email: string; role: string; tenant_id: string | null }) {
  const token = await signToken({ sub: p.id, email: p.email, role: p.role, tenant_id: String(p.tenant_id ?? ''), app: 'web' })
  state.db.tables.synapse_sessions.push({ id: `s-${p.id}-${state.db.tables.synapse_sessions.length}`, user_id: p.id, token_hash: hashToken(token), expires_at: FUTURE, revoked_at: null })
  return token
}
const row = (id: string) => state.db.tables.profiles.find((p: any) => p.id === id)
async function signInAsActor() { env.token = await sessionFor(row(ACTOR)) }

function form(values: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}
async function login(id: string) {
  const req = new Request('https://synapseos.tech/api/auth/password-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: row(id).email, password: PASSWORD }),
  })
  const res = await passwordLogin(req as any)
  return { status: res.status, body: await res.json() }
}
const verificationWrites = () =>
  state.db.log.filter((l: any) => l.table === 'profiles' && l.payload && Object.prototype.hasOwnProperty.call(l.payload, 'verification_status'))
const memberships = (id: string) => state.db.tables.platform_memberships.filter((m: any) => m.user_id === id)
const audits = (action: string) => state.db.tables.audit_log.filter((a: any) => a.action === action)

beforeAll(async () => { passwordHash = await hashPassword(PASSWORD) })

describe('suspend a tenant user with no platform membership (marker row)', () => {
  beforeEach(() => { env.token = null; state.sentOtps = 0; seed() })

  it('suspend -> sessions revoked, login denied with the unavailable message, filter finds it; unsuspend -> login ok', async () => {
    const doctor = row(DOCTOR)
    await sessionFor(doctor)
    expect((await login(DOCTOR)).status).toBe(200)
    const otpsBefore = state.sentOtps

    await signInAsActor()
    expect(await suspendUserAccount(form({ user_id: DOCTOR, reason: 'synthetic investigation' }))).toEqual({ ok: true })

    // Never writes 'suspended' (or anything) into verification_status.
    expect(verificationWrites()).toEqual([])
    expect(row(DOCTOR).verification_status).toBe('verified')
    // Marker row: SUSPENDED, no-access role, tagged in metadata.
    expect(memberships(DOCTOR)).toEqual([
      expect.objectContaining({ status: 'SUSPENDED', platform_role: 'READ_ONLY_OBSERVER', metadata: expect.objectContaining({ account_suspension: expect.objectContaining({ marker: true, suspended_by: ACTOR, reason: 'synthetic investigation' }) }) }),
    ])
    // Existing sessions revoked.
    expect(state.db.tables.synapse_sessions.filter((s: any) => s.user_id === DOCTOR)).toEqual([])
    expect(audits('user.suspended')).toEqual([expect.objectContaining({ record_id: DOCTOR, user_id: ACTOR })])

    // Login denied with the correct message and no OTP sent.
    expect(await login(DOCTOR)).toEqual({ status: 403, body: { error: ACCOUNT_UNAVAILABLE_ERROR, code: 'ACCOUNT_UNAVAILABLE' } })
    expect(state.sentOtps).toBe(otpsBefore)
    // Any other path that tries to mint a session is stopped by the createSession backstop.
    await expect(createSession({ userId: DOCTOR, token: 'synthetic', app: 'web' })).rejects.toBeInstanceOf(AccountSuspendedError)

    // Suspended filter finds it; Active excludes it; row is flagged for the UI.
    const suspended = await searchPlatformUsers(state.db, { status: 'suspended' })
    expect(suspended.rows.map((r) => r.id)).toEqual([DOCTOR])
    expect(suspended.rows[0].account_suspended).toBe(true)
    expect((await searchPlatformUsers(state.db, { status: 'active' })).rows.map((r) => r.id)).not.toContain(DOCTOR)
    // The marker is not a platform member.
    expect((await listPlatformMembers()).map((m) => m.userId)).not.toContain(DOCTOR)
    // Double suspend refused.
    expect(await suspendUserAccount(form({ user_id: DOCTOR, reason: 'again' }))).toMatchObject({ ok: false, error: /already suspended/ })
    // Restore does not pretend to lift a suspension.
    expect(await restoreUserAccount(form({ user_id: DOCTOR }))).toMatchObject({ ok: false, error: /Reactivate/ })

    // Unsuspend: marker removed, login works again.
    expect(await reactivateUserAccount(form({ user_id: DOCTOR }))).toEqual({ ok: true })
    expect(memberships(DOCTOR)).toEqual([])
    expect(verificationWrites()).toEqual([])
    expect(audits('user.reactivated')).toHaveLength(1)
    expect((await login(DOCTOR)).status).toBe(200)
    expect((await searchPlatformUsers(state.db, { status: 'suspended' })).total).toBe(0)
    expect((await searchPlatformUsers(state.db, { status: 'active' })).rows.map((r) => r.id)).toContain(DOCTOR)
    expect(await reactivateUserAccount(form({ user_id: DOCTOR }))).toMatchObject({ ok: false, error: /not suspended/ })
  })
})

describe('suspend a control-plane member (membership flipped, previous status restored)', () => {
  beforeEach(() => { env.token = null; seed() })

  it('an existing session of the suspended member is rejected by session validation', async () => {
    const supportToken = await sessionFor(row(SUPPORT))
    await signInAsActor()
    expect(await suspendUserAccount(form({ user_id: SUPPORT, reason: 'synthetic' }))).toEqual({ ok: true })
    expect(memberships(SUPPORT)).toEqual([
      expect.objectContaining({ id: 'm-support', status: 'SUSPENDED', platform_role: 'SUPPORT_ADMIN', metadata: expect.objectContaining({ invited_note: 'keep', account_suspension: expect.objectContaining({ previous_status: 'ACTIVE' }) }) }),
    ])
    // Even a session row that somehow survived is rejected: context fails closed on SUSPENDED membership.
    state.db.tables.synapse_sessions.push({ id: 's-leftover', user_id: SUPPORT, token_hash: hashToken(supportToken), expires_at: FUTURE, revoked_at: null })
    env.token = supportToken
    await expect(searchAsPlatform()).rejects.toThrow(/NEXT_REDIRECT/)

    await signInAsActor()
    expect(await reactivateUserAccount(form({ user_id: SUPPORT }))).toEqual({ ok: true })
    expect(memberships(SUPPORT)).toEqual([expect.objectContaining({ status: 'ACTIVE', metadata: { invited_note: 'keep' } })])
    expect(verificationWrites()).toEqual([])
  })

  it('a membership suspended from Platform Access (no account_suspension metadata) must be reactivated there', async () => {
    state.db.tables.platform_memberships.find((m: any) => m.id === 'm-support').status = 'SUSPENDED'
    await signInAsActor()
    expect(await reactivateUserAccount(form({ user_id: SUPPORT }))).toMatchObject({ ok: false, error: /Platform Access/ })
    expect(memberships(SUPPORT)[0].status).toBe('SUSPENDED')
  })

  it('suspended platform admins do not count toward "another admin remains"', async () => {
    const third = '00000000-0000-4000-8000-0000000000a3'
    state.db.tables.profiles.push(profile(third))
    state.db.tables.platform_memberships.push({ id: 'm-a3', user_id: third, platform_role: 'PLATFORM_ADMIN', status: 'ACTIVE', expires_at: null, mfa_required: false, metadata: {} })
    await signInAsActor()
    const { archiveUserAccount } = await import('./actions')
    // Suspend OTHER_ADMIN: usable admins are now ACTOR and third.
    expect(await suspendUserAccount(form({ user_id: OTHER_ADMIN, reason: 'synthetic' }))).toEqual({ ok: true })
    // Archiving the suspended admin is allowed (it is not a usable admin; ACTOR remains).
    expect(await archiveUserAccount(form({ user_id: OTHER_ADMIN, reason: 'x' }))).toEqual({ ok: true })
    // Suspending third would leave ACTOR as the only usable admin: allowed (ACTOR remains).
    expect(await suspendUserAccount(form({ user_id: third, reason: 'x' }))).toEqual({ ok: true })
    // Now a fourth, unsuspended admin target: ACTOR is the only usable admin besides it.
    const fourth = '00000000-0000-4000-8000-0000000000a4'
    state.db.tables.profiles.push(profile(fourth))
    expect(await archiveUserAccount(form({ user_id: fourth, reason: 'x' }))).toEqual({ ok: true })
  })
})

describe('capability enforcement', () => {
  beforeEach(() => { env.token = null })

  it('SUPPORT_ADMIN (user.read only) cannot suspend or unsuspend', async () => {
    expect(roleHasCapability('SUPPORT_ADMIN', 'user.suspend')).toBe(false)
    expect(roleHasCapability('SUPPORT_ADMIN', 'user.reactivate')).toBe(false)
    seed('SUPPORT_ADMIN')
    await signInAsActor()
    await expect(suspendUserAccount(form({ user_id: DOCTOR, reason: 'r' }))).rejects.toThrow(/NEXT_REDIRECT \/platform\?error=forbidden/)
    expect(memberships(DOCTOR)).toEqual([])
    state.db.tables.platform_memberships.push({ id: 'm-doc', user_id: DOCTOR, platform_role: 'READ_ONLY_OBSERVER', status: 'SUSPENDED', metadata: { account_suspension: { marker: true } } })
    await expect(reactivateUserAccount(form({ user_id: DOCTOR }))).rejects.toThrow(/NEXT_REDIRECT \/platform\?error=forbidden/)
    expect(memberships(DOCTOR)).toHaveLength(1)
  })

  it('a hospital_admin (no platform membership) cannot suspend', async () => {
    seed()
    const hosp = profile('00000000-0000-4000-8000-0000000000b1', { role: 'hospital_admin', tenant_id: TENANT })
    state.db.tables.profiles.push(hosp)
    env.token = await sessionFor(hosp as any)
    await expect(suspendUserAccount(form({ user_id: DOCTOR, reason: 'r' }))).rejects.toThrow(/NEXT_REDIRECT \/platform\/login/)
    expect(memberships(DOCTOR)).toEqual([])
  })
})

async function searchAsPlatform() {
  const { requirePlatformAccess } = await import('../../../lib/platform/auth')
  return requirePlatformAccess('user.read')
}
