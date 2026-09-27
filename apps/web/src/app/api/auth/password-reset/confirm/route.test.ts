/**
 * Completing a password reset (web and mobile) activates the email address but must
 * never change professional verification (KYC). Previously both routes wrote
 * verification_status='verified', so a pending or rejected professional could
 * self-upgrade their KYC status through forgot-password. In-memory DB, synthetic data.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => { process.env.SYNAPSE_JWT_SECRET = 'synthetic-test-secret-for-reset-confirm-0123456789' })
const state = vi.hoisted(() => ({ db: null as any }))
vi.mock('@synapse/db/admin', () => ({ supabaseAdmin: { from: (t: string) => state.db.from(t) } }))

import { hashToken, signShortToken } from '@synapse/auth'
import { createMemoryDb } from '../../../../../test-utils/memory-postgrest'
import { POST as webConfirm } from './route'
import { POST as mobileConfirm } from '../../mobile/reset-password/route'

const USER = '00000000-0000-4000-8000-0000000000d7'
const FUTURE = new Date(Date.now() + 15 * 60_000).toISOString()

async function seed(verification_status: string) {
  const token = await signShortToken({ sub: USER, purpose: 'reset' })
  state.db = createMemoryDb({
    profiles: [{ id: USER, email: 'doc@synthetic.synapse.test', role: 'doctor', verification_status, email_verified_at: null, must_change_password: true, is_deleted: false }],
    password_reset_tokens: [{ id: 'r1', user_id: USER, token_hash: hashToken(token), expires_at: FUTURE, used_at: null }],
    synapse_sessions: [{ id: 's1', user_id: USER, token_hash: 'x', expires_at: FUTURE, revoked_at: null }],
  })
  return token
}

const profile = () => state.db.tables.profiles[0]

describe.each([
  ['web /api/auth/password-reset/confirm', webConfirm],
  ['mobile /api/auth/mobile/reset-password', mobileConfirm],
])('%s', (_name, POST) => {
  beforeEach(() => { state.db = null })

  it.each(['pending', 'under_review', 'rejected'])('keeps verification_status=%s and activates the email', async (status) => {
    const token = await seed(status)
    const req = new Request('https://synapseos.tech/reset', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: 'Synthetic-Str0ng-Passw0rd!' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(profile().verification_status).toBe(status)
    expect(profile().email_verified_at).toEqual(expect.any(String))
    expect(profile().must_change_password).toBe(false)
    const writes = state.db.log.filter((l: any) => l.table === 'profiles' && l.op === 'update')
    expect(writes.some((w: any) => 'verification_status' in (w.payload ?? {}))).toBe(false)
  })
})
