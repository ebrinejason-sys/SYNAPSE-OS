import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  send: vi.fn(),
  rate: vi.fn(),
}))

vi.mock('../../../../../lib/auth/activation-email', () => ({
  trySendActivationEmail: (...a: unknown[]) => mocks.send(...a),
}))
vi.mock('../../../../../lib/rate-limit', () => ({
  checkRateLimit: (...a: unknown[]) => mocks.rate(...a),
  rateLimiters: { auth: {} },
}))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = { then: (r: any) => Promise.resolve({ data: null, error: null }).then(r) }
      for (const m of ['select', 'eq', 'update']) q[m] = vi.fn(() => q)
      q.maybeSingle = vi.fn(async () => ({ data: mocks.profile, error: null }))
      return q
    },
  },
}))

async function resend(email = 'someone@example.test') {
  const { POST } = await import('./route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest('https://admin.synapseos.tech/api/auth/activation/resend', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ email }),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json() }
}

const verified = '2026-09-01T00:00:00.000Z'

describe('POST /api/auth/activation/resend (canonical, anti-enumeration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rate.mockResolvedValue({ success: true, remaining: 5 })
    mocks.send.mockResolvedValue({ sent: true })
  })

  it.each([
    ['unknown', null],
    ['archived', { id: 'u', email: 'someone@example.test', email_verified_at: verified, is_deleted: true }],
    ['archived and unverified', { id: 'u', email: 'someone@example.test', email_verified_at: null, is_deleted: true }],
    ['suspended', { id: 'u', email: 'someone@example.test', email_verified_at: null, verification_status: 'suspended' }],
    ['already verified', { id: 'u', email: 'someone@example.test', email_verified_at: verified }],
  ])('%s: identical generic response, no email', async (_l, profile) => {
    mocks.profile = profile
    expect(await resend()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('pending account: email sent, same generic response (no userId leak)', async () => {
    mocks.profile = { id: 'u-pending', email: 'someone@example.test', full_name: 'Pat', email_verified_at: null, verification_status: 'pending' }
    expect(await resend()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('pending account with delivery failure: still the generic response', async () => {
    mocks.profile = { id: 'u-pending', email: 'someone@example.test', email_verified_at: null }
    mocks.send.mockResolvedValue({ sent: false, error: 'smtp down' })
    expect(await resend()).toEqual({ status: 200, body: { ok: true } })
  })

  it('is rate limited per IP and per email via the shared auth limiter', async () => {
    mocks.profile = { id: 'u', email: 'someone@example.test', email_verified_at: null }
    await resend('Someone@Example.test')
    expect(mocks.rate).toHaveBeenCalledWith({}, 'activation-resend:ip:203.0.113.9')
    expect(mocks.rate).toHaveBeenCalledWith({}, 'activation-resend:email:someone@example.test')

    mocks.rate.mockResolvedValueOnce({ success: false, remaining: 0 })
    const limited = await resend()
    expect(limited.status).toBe(429)
  })
})
