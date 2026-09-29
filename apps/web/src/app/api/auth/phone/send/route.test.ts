import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAccountActivated } from '../../../../../../../../packages/auth/src/activation'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  createAndSendOTP: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  isAccountActivated,
  createAndSendOTP: (...a: unknown[]) => mocks.createAndSendOTP(...a),
  withMembershipSuspension: async (p: Record<string, unknown>) => ({ ...p, membership_suspended: false }),
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

async function send(phone = '+256700000001') {
  const { POST } = await import('./route')
  const req = new Request('https://synapseos.tech/api/auth/phone/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

const active = { id: 'u', email_verified_at: '2026-09-01T00:00:00.000Z', verification_status: 'verified' }

describe('POST /api/auth/phone/send (pre-proof, anti-enumeration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.createAndSendOTP.mockResolvedValue('123456')
    mocks.fetch.mockResolvedValue(new Response('{}', { status: 201 }))
  })

  it('rejects malformed numbers', async () => {
    expect((await send('0700')).status).toBe(400)
  })

  it('unknown number returns the generic ok and sends nothing', async () => {
    mocks.profile = null
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it('archived account is indistinguishable and gets no code', async () => {
    mocks.profile = { ...active, is_deleted: true }
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it('active account gets a code', async () => {
    mocks.profile = active
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('SMS delivery failure is indistinguishable from unknown', async () => {
    mocks.profile = active
    mocks.fetch.mockResolvedValue(new Response('provider down', { status: 500 }))
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
  })

  it('per-target rate limiting is indistinguishable from unknown', async () => {
    mocks.profile = active
    mocks.createAndSendOTP.mockRejectedValue(new Error('TOO_MANY_REQUESTS'))
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
  })
})
