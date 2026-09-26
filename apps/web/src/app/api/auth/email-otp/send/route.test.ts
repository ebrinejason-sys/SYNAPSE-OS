import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAccountActivated } from '../../../../../../../../packages/auth/src/activation'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  createAndSendOTP: vi.fn(),
  sendOtpEmail: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  isAccountActivated,
  createAndSendOTP: (...a: unknown[]) => mocks.createAndSendOTP(...a),
  shouldSkipOtpEmailDelivery: () => false,
}))
vi.mock('../../../../../lib/resend', () => ({ sendOtpEmail: (...a: unknown[]) => mocks.sendOtpEmail(...a) }))
vi.mock('../../../../../lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  rateLimiters: { auth: {} },
}))
vi.mock('../../../../../lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => {
      const q: any = {}
      for (const m of ['select', 'eq']) q[m] = vi.fn(() => q)
      q.maybeSingle = vi.fn(async () => ({ data: mocks.profile, error: null }))
      return q
    },
  }),
}))

async function send() {
  const { POST } = await import('./route')
  const req = new Request('https://synapseos.tech/api/auth/email-otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'someone@example.test' }),
  })
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

const verified = '2026-09-01T00:00:00.000Z'

describe('POST /api/auth/email-otp/send (pre-proof, anti-enumeration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAndSendOTP.mockResolvedValue('123456')
  })

  it('unknown email returns the generic ok', async () => {
    mocks.profile = null
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it.each([
    ['archived', { id: 'u', email_verified_at: verified, is_deleted: true }],
    ['suspended', { id: 'u', email_verified_at: verified, verification_status: 'suspended' }],
    ['unverified', { id: 'u', email_verified_at: null }],
  ])('%s account is indistinguishable from unknown and gets no code', async (_l, profile) => {
    mocks.profile = profile
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
    expect(mocks.sendOtpEmail).not.toHaveBeenCalled()
  })

  it('active account gets a code', async () => {
    mocks.profile = { id: 'u', tenant_id: null, email_verified_at: verified, verification_status: 'verified' }
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).toHaveBeenCalledTimes(1)
    expect(mocks.sendOtpEmail).toHaveBeenCalledTimes(1)
  })
})
