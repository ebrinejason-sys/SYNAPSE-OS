import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_ACTIVATION_ERROR,
  ACCOUNT_UNAVAILABLE_ERROR,
  accountStateResponse,
  classifyAccountState,
  isAccountActivated,
  type AccountState,
  type AccountStateProfile,
} from './activation'

const verified = '2026-09-01T00:00:00.000Z'
const now = new Date('2026-09-26T12:00:00.000Z')
const future = '2026-09-26T13:00:00.000Z'
const past = '2026-09-26T11:00:00.000Z'

const matrix: Array<[string, AccountStateProfile, AccountState]> = [
  ['active', { email_verified_at: verified, verification_status: 'verified', is_deleted: false }, 'active'],
  ['unverified', { email_verified_at: null, verification_status: 'pending' }, 'unverified'],
  ['archived (is_deleted) even though verified', { email_verified_at: verified, verification_status: 'verified', is_deleted: true }, 'archived'],
  ['archived and unverified', { email_verified_at: null, is_deleted: true }, 'archived'],
  ['status deleted', { email_verified_at: verified, verification_status: 'deleted' }, 'archived'],
  ['suspended', { email_verified_at: verified, verification_status: 'suspended' }, 'suspended'],
  ['suspended and unverified', { email_verified_at: null, verification_status: 'SUSPENDED' }, 'suspended'],
  ['disabled', { email_verified_at: verified, verification_status: 'disabled' }, 'suspended'],
  ['reset stays blocked', { email_verified_at: verified, verification_status: 'reset' }, 'suspended'],
  ['locked', { email_verified_at: verified, locked_until: future }, 'locked'],
  ['expired lock', { email_verified_at: verified, locked_until: past }, 'active'],
  ['password change required', { email_verified_at: verified, must_change_password: true }, 'password_change_required'],
]

describe('classifyAccountState', () => {
  it.each(matrix)('%s', (_label, profile, expected) => {
    expect(classifyAccountState(profile, now)).toBe(expected)
  })
})

describe('accountStateResponse', () => {
  it('only unverified accounts get the activation message and resend flag', () => {
    expect(accountStateResponse('unverified')).toEqual({
      status: 403,
      body: { error: ACCOUNT_ACTIVATION_ERROR, code: 'ACCOUNT_UNVERIFIED', activationRequired: true },
    })
  })

  it.each(['archived', 'suspended'] as const)('%s accounts get the unavailable message, never the activation message', (state) => {
    const res = accountStateResponse(state)
    expect(res?.status).toBe(403)
    expect(res?.body).toEqual({ error: ACCOUNT_UNAVAILABLE_ERROR, code: 'ACCOUNT_UNAVAILABLE' })
    expect(res?.body.error).not.toBe(ACCOUNT_ACTIVATION_ERROR)
  })

  it('locked accounts get 429', () => {
    expect(accountStateResponse('locked')?.status).toBe(429)
  })

  it.each(['active', 'password_change_required'] as const)('%s continues sign-in', (state) => {
    expect(accountStateResponse(state)).toBeNull()
  })
})

describe('isAccountActivated (session guards)', () => {
  it('rejects archived, suspended and unverified identities', () => {
    expect(isAccountActivated({ email_verified_at: verified, is_deleted: true })).toBe(false)
    expect(isAccountActivated({ email_verified_at: verified, verification_status: 'suspended' })).toBe(false)
    expect(isAccountActivated({ email_verified_at: null })).toBe(false)
  })

  it('accepts active and password-change-required identities and ignores lockouts', () => {
    expect(isAccountActivated({ email_verified_at: verified })).toBe(true)
    expect(isAccountActivated({ email_verified_at: verified, must_change_password: true })).toBe(true)
    expect(isAccountActivated({ email_verified_at: verified, locked_until: '2999-01-01T00:00:00Z' })).toBe(true)
  })
})
