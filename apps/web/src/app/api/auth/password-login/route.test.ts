import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCOUNT_ACTIVATION_ERROR,
  ACCOUNT_UNAVAILABLE_ERROR,
  accountStateResponse,
  classifyAccountState,
  isAccountActivated,
} from '../../../../../../../packages/auth/src/activation'

const mocks = vi.hoisted(() => ({
  profiles: [] as Array<Record<string, unknown>>,
  verifyPassword: vi.fn(),
  createAndSendOTP: vi.fn(),
  sendOtpEmail: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  ACCOUNT_ACTIVATION_ERROR,
  accountStateResponse,
  classifyAccountState,
  isAccountActivated,
  verifyPassword: (...a: unknown[]) => mocks.verifyPassword(...a),
  createAndSendOTP: (...a: unknown[]) => mocks.createAndSendOTP(...a),
  shouldSkipOtpEmailDelivery: () => false,
}))
vi.mock('@synapse/auth/mfa', () => ({
  signMfaPendingToken: vi.fn(async () => 'pending'),
  mfaCookieOptions: {},
  MFA_PENDING_COOKIE: 'synapse_mfa_pending',
}))
vi.mock('../../../../lib/resend', () => ({ sendOtpEmail: (...a: unknown[]) => mocks.sendOtpEmail(...a) }))

function chain(result: unknown) {
  const q: any = { then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) }
  for (const m of ['select', 'eq', 'in', 'is', 'update', 'order']) q[m] = vi.fn(() => q)
  q.limit = vi.fn(async () => result)
  q.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  return q
}

vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === 'profiles' ? chain({ data: mocks.profiles, error: null }) : chain({ data: null, error: null }),
  },
}))

const verified = '2026-09-01T00:00:00.000Z'
const base = {
  id: 'user-1',
  email: 'staff@example.test',
  role: 'doctor',
  tenant_id: 'tenant-1',
  password_hash: 'hash',
  login_attempts: 0,
  locked_until: null,
  verification_status: 'verified',
  email_verified_at: verified,
  is_deleted: false,
}

async function login(password = 'correct-password') {
  const { POST } = await import('./route')
  const req = new Request('https://synapseos.tech/api/auth/password-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'staff@example.test', password }),
  })
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

describe('POST /api/auth/password-login account-state matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profiles = [{ ...base }]
    mocks.verifyPassword.mockImplementation(async (pw: string) => pw === 'correct-password')
    mocks.createAndSendOTP.mockResolvedValue('123456')
    mocks.sendOtpEmail.mockResolvedValue(undefined)
  })

  it('unknown email stays generic', async () => {
    mocks.profiles = []
    const r = await login()
    expect(r).toEqual({ status: 401, body: { error: 'Invalid email or password' } })
  })

  it.each([
    ['archived', { is_deleted: true }],
    ['suspended', { verification_status: 'suspended' }],
    ['unverified', { email_verified_at: null }],
  ])('wrong password on a %s account stays generic (no state leak)', async (_label, patch) => {
    mocks.profiles = [{ ...base, ...patch }]
    const r = await login('wrong-password')
    expect(r).toEqual({ status: 401, body: { error: 'Invalid email or password' } })
  })

  it('archived account with correct password gets the unavailable message, not activation', async () => {
    mocks.profiles = [{ ...base, is_deleted: true }]
    const r = await login()
    expect(r.status).toBe(403)
    expect(r.body).toEqual({ error: ACCOUNT_UNAVAILABLE_ERROR, code: 'ACCOUNT_UNAVAILABLE' })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it.each(['suspended', 'disabled'])('%s account with correct password gets the unavailable message', async (status) => {
    mocks.profiles = [{ ...base, verification_status: status }]
    const r = await login()
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('ACCOUNT_UNAVAILABLE')
    expect(r.body.error).not.toBe(ACCOUNT_ACTIVATION_ERROR)
  })

  it('genuinely unverified account with correct password gets activation message and resend flag', async () => {
    mocks.profiles = [{ ...base, email_verified_at: null, verification_status: 'pending' }]
    const r = await login()
    expect(r.status).toBe(403)
    expect(r.body).toEqual({ error: ACCOUNT_ACTIVATION_ERROR, code: 'ACCOUNT_UNVERIFIED', activationRequired: true })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it('active account proceeds to the email OTP step', async () => {
    const r = await login()
    expect(r).toEqual({ status: 200, body: { otpSent: true } })
    expect(mocks.createAndSendOTP).toHaveBeenCalledTimes(1)
  })
})
