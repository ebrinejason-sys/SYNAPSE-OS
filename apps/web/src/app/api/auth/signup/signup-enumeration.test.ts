import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  existing: null as Record<string, unknown> | null,
  inserts: [] as Array<{ table: string; values: any }>,
  send: vi.fn(),
  hash: vi.fn(),
  rate: vi.fn(),
}))

vi.mock('@synapse/auth', () => ({
  hashPassword: (...a: unknown[]) => mocks.hash(...a),
  validatePasswordStrength: () => ({ valid: true, errors: [] }),
}))
vi.mock('../../../../lib/auth/activation-email', () => ({
  trySendActivationEmail: (...a: unknown[]) => mocks.send(...a),
}))
vi.mock('../../../../lib/rate-limit', () => ({
  checkRateLimit: (...a: unknown[]) => mocks.rate(...a),
  rateLimiters: { auth: {} },
}))
vi.mock('@synapse/db/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q: any = { then: (r: any) => Promise.resolve({ data: null, error: null }).then(r) }
      for (const m of ['select', 'eq', 'update', 'delete', 'upsert']) q[m] = vi.fn(() => q)
      q.insert = vi.fn((values: any) => {
        mocks.inserts.push({ table, values })
        return q
      })
      q.maybeSingle = vi.fn(async () => ({ data: mocks.existing, error: null }))
      return q
    },
  },
}))

const bodies = {
  patient: { first_name: 'Test', last_name: 'Person', email: 'Person@Example.test', password: 'Str0ng!Passw0rd' },
  professional: {
    first_name: 'Test', last_name: 'Clinician', email: 'Person@Example.test', password: 'Str0ng!Passw0rd',
    specialty: 'General Practice', license_number: 'SYN-TEST-1',
  },
}

async function signup(kind: 'patient' | 'professional') {
  const mod = kind === 'patient' ? await import('./patient/route') : await import('./professional/route')
  const { NextRequest } = await import('next/server')
  const req = new NextRequest(`https://synapseos.tech/api/auth/signup/${kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
    body: JSON.stringify(bodies[kind]),
  })
  const res = await mod.POST(req)
  return { status: res.status, body: await res.json() }
}

const verified = '2026-09-01T00:00:00.000Z'
const existingCases: Array<[string, Record<string, unknown>]> = [
  ['existing verified', { id: 'existing-1', email: 'person@example.test', email_verified_at: verified, verification_status: 'verified' }],
  ['existing unverified', { id: 'existing-1', email: 'person@example.test', email_verified_at: null, verification_status: 'pending' }],
  ['existing archived', { id: 'existing-1', email: 'person@example.test', email_verified_at: verified, is_deleted: true }],
  ['existing suspended', { id: 'existing-1', email: 'person@example.test', email_verified_at: null, verification_status: 'suspended' }],
]

describe.each(['patient', 'professional'] as const)('POST /api/auth/signup/%s anti-enumeration', (kind) => {
  let newAccount: { status: number; body: unknown }

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.inserts = []
    mocks.rate.mockResolvedValue({ success: true, remaining: 5 })
    mocks.hash.mockResolvedValue('hashed')
    mocks.send.mockResolvedValue({ sent: true })
    mocks.existing = null
    newAccount = await signup(kind)
    vi.clearAllMocks()
    mocks.inserts = []
    mocks.rate.mockResolvedValue({ success: true, remaining: 5 })
    mocks.hash.mockResolvedValue('hashed')
    mocks.send.mockResolvedValue({ sent: true })
  })

  it('new account: generic accepted response without userId', () => {
    expect(newAccount).toEqual({ status: 200, body: { ok: true, activationRequired: true } })
  })

  it.each(existingCases)('%s: identical status and body to a new account, no insert', async (_l, existing) => {
    mocks.existing = existing
    const r = await signup(kind)
    expect(r).toEqual(newAccount)
    expect(JSON.stringify(r.body)).not.toContain('existing-1')
    expect(mocks.inserts.filter((i) => i.table === 'profiles')).toEqual([])
  })

  it('password is hashed on the existing-account path too (timing parity)', async () => {
    mocks.existing = existingCases[0][1]
    await signup(kind)
    expect(mocks.hash).toHaveBeenCalledTimes(1)
  })

  it('existing unverified account is re-sent its activation email; verified/archived/suspended get nothing', async () => {
    mocks.existing = existingCases[1][1]
    await signup(kind)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    for (const idx of [0, 2, 3]) {
      vi.clearAllMocks()
      mocks.rate.mockResolvedValue({ success: true, remaining: 5 })
      mocks.hash.mockResolvedValue('hashed')
      mocks.existing = existingCases[idx][1]
      await signup(kind)
      expect(mocks.send).not.toHaveBeenCalled()
    }
  })

  it('delivery failure on a new account does not change the public response', async () => {
    mocks.existing = null
    mocks.send.mockResolvedValue({ sent: false, error: 'smtp down' })
    expect(await signup(kind)).toEqual(newAccount)
  })

  it('is rate limited per IP with the shared auth limiter', async () => {
    mocks.rate.mockResolvedValueOnce({ success: false, remaining: 0 })
    const r = await signup(kind)
    expect(r.status).toBe(429)
    expect(mocks.rate).toHaveBeenCalledWith({}, `signup-${kind}:ip:198.51.100.7`)
    expect(mocks.inserts).toEqual([])
  })
})
