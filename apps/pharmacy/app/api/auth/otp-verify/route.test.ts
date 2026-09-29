import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCOUNT_ACTIVATION_ERROR,
  ACCOUNT_UNAVAILABLE_ERROR,
  accountStateResponse,
  classifyAccountState,
} from '../../../../../../packages/auth/src/activation'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  verifyOTP: vi.fn(),
  createSession: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  accountStateResponse,
  classifyAccountState,
  verifyOTP: (...a: unknown[]) => mocks.verifyOTP(...a),
  signToken: vi.fn(async () => 'signed'),
  createSession: (...a: unknown[]) => mocks.createSession(...a),
}))
vi.mock('@synapse/config/constants', () => ({ SESSION_COOKIE: 'synapse_session', SESSION_DURATION_DAYS: 1 }))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = { then: (r: any) => Promise.resolve({ data: null, error: null }).then(r) }
      for (const m of ['select', 'eq', 'update']) q[m] = vi.fn(() => q)
      q.single = vi.fn(async () => ({ data: mocks.profile, error: mocks.profile ? null : { code: 'PGRST116' } }))
      return q
    },
  },
}))

async function verify() {
  const { POST } = await import('./route')
  const req = new Request('https://pharm.synapseos.tech/api/auth/otp-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'pharm@example.test', otp: '123456' }),
  })
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

const verified = '2026-09-01T00:00:00.000Z'
const base = { id: 'u', role: 'pharmacist', tenant_id: 't', synapse_id: null, must_change_password: false, email_verified_at: verified, verification_status: 'verified', is_deleted: false }

describe('pharmacy POST /api/auth/otp-verify account-state gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyOTP.mockResolvedValue({ valid: true })
  })

  it('invalid OTP never reveals account state', async () => {
    mocks.verifyOTP.mockResolvedValue({ valid: false, error: 'INVALID' })
    mocks.profile = { ...base, is_deleted: true }
    const r = await verify()
    expect(r.status).toBe(401)
    expect(r.body.code).toBeUndefined()
  })

  it.each([
    ['archived', { is_deleted: true }, ACCOUNT_UNAVAILABLE_ERROR],
    ['suspended', { verification_status: 'suspended' }, ACCOUNT_UNAVAILABLE_ERROR],
    ['unverified', { email_verified_at: null }, ACCOUNT_ACTIVATION_ERROR],
  ])('%s identity is refused a session after OTP proof', async (_l, patch, message) => {
    mocks.profile = { ...base, ...patch }
    const r = await verify()
    expect(r.status).toBe(403)
    expect(r.body.error).toBe(message)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('active identity gets a session', async () => {
    mocks.profile = { ...base }
    const r = await verify()
    expect(r.status).toBe(200)
    expect(mocks.createSession).toHaveBeenCalledTimes(1)
  })
})
