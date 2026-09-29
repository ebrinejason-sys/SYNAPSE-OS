import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAccountActivated } from '../../../../../../packages/auth/src/activation'

const mocks = vi.hoisted(() => ({
  suspendedIds: new Set<string>(),
  profile: null as Record<string, unknown> | null,
  createAndSendOTP: vi.fn(),
  sendOTP: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  isAccountActivated,
  createAndSendOTP: (...a: unknown[]) => mocks.createAndSendOTP(...a),  withMembershipSuspension: async (p: { id?: unknown }) => ({ ...p, membership_suspended: mocks.suspendedIds.has(String(p.id)) }),
}))
vi.mock('@synapse/email', () => ({ sendOTP: (...a: unknown[]) => mocks.sendOTP(...a) }))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = {}
      for (const m of ['select', 'eq']) q[m] = vi.fn(() => q)
      q.single = vi.fn(async () => ({ data: mocks.profile, error: null }))
      return q
    },
  },
}))

async function send() {
  const { POST } = await import('./route')
  const req = new Request('https://pharm.synapseos.tech/api/auth/otp-send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'pharm@example.test' }),
  })
  const res = await POST(req as any)
  return { status: res.status, body: await res.json() }
}

const verified = '2026-09-01T00:00:00.000Z'

describe('pharmacy POST /api/auth/otp-send (pre-proof)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAndSendOTP.mockResolvedValue('123456')
    mocks.suspendedIds = new Set()
  })

  it.each([
    ['unknown', null],
    ['archived', { full_name: 'A', email_verified_at: verified, is_deleted: true }],
    ['suspended', { full_name: 'A', email_verified_at: verified, verification_status: 'suspended' }],
    ['unverified', { full_name: 'A', email_verified_at: null }],
    ['membership-suspended', { id: 'suspended-user', full_name: 'A', email_verified_at: verified, verification_status: 'verified' }],
  ])('%s account: generic ok and no code issued', async (_l, profile) => {
    mocks.profile = profile
    mocks.suspendedIds = new Set(['suspended-user'])
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).not.toHaveBeenCalled()
  })

  it('active account: code issued', async () => {
    mocks.profile = { full_name: 'A', email_verified_at: verified, verification_status: 'verified' }
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.createAndSendOTP).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['delivery failure', () => mocks.sendOTP.mockRejectedValueOnce(new Error('provider down'))],
    ['per-target rate limit', () => mocks.createAndSendOTP.mockRejectedValueOnce(new Error('TOO_MANY_REQUESTS'))],
  ])('active account %s is indistinguishable from unknown', async (_l, arrange) => {
    mocks.profile = { full_name: 'A', email_verified_at: verified, verification_status: 'verified' }
    arrange()
    expect(await send()).toEqual({ status: 200, body: { ok: true } })
  })
})
