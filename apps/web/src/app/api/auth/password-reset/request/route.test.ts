import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  send: vi.fn(),
}))

vi.mock('@/lib/auth/password-reset.server', () => ({
  sendUserPasswordReset: (...a: unknown[]) => mocks.send(...a),
}))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = {}
      for (const m of ['select', 'eq']) q[m] = vi.fn(() => q)
      q.maybeSingle = vi.fn(async () => ({ data: mocks.profile, error: null }))
      return q
    },
  },
}))

async function request(email: string) {
  const { POST } = await import('./route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest('https://admin.synapseos.tech/api/auth/password-reset/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json() }
}

describe('password reset request: neutral responses', () => {
  beforeEach(() => {
    mocks.profile = null
    mocks.send.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('returns ok for an unknown email without sending', async () => {
    const res = await request('nobody@example.test')
    expect(res).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('returns ok when the reset email is sent', async () => {
    mocks.profile = { id: 'u1', email: 'user@example.test', full_name: 'User' }
    mocks.send.mockResolvedValue({ ok: true, email: 'user@example.test' })
    expect(await request('user@example.test')).toEqual({ status: 200, body: { ok: true } })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('does not reveal an existing account when email delivery fails (no 500 oracle)', async () => {
    mocks.profile = { id: 'u1', email: 'user@example.test', full_name: 'User' }
    mocks.send.mockResolvedValue({ ok: false, error: 'Failed to send reset email.' })
    const existing = await request('user@example.test')
    mocks.profile = null
    const unknown = await request('nobody@example.test')
    expect(existing).toEqual(unknown)
    expect(existing.status).toBe(200)
  })
})
