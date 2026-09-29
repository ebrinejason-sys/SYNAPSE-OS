/**
 * Account state classification for sign-in and session guards.
 *
 * Anti-enumeration contract: callers must only surface the state-specific
 * response from `accountStateResponse()` AFTER the caller has proven possession
 * of a credential (correct password or a valid OTP). Unknown identifiers and
 * wrong passwords must keep returning the generic credential error, and
 * pre-proof endpoints (OTP send) must answer non-active accounts exactly like
 * unknown identifiers.
 */

export const ACCOUNT_ACTIVATION_ERROR =
  'Activate your account from the email we sent before signing in.'

export const ACCOUNT_UNAVAILABLE_ERROR =
  'This account is unavailable. Contact your administrator.'

export const ACCOUNT_LOCKED_ERROR = 'Account temporarily locked. Try again later.'

export type AccountState =
  | 'active'
  | 'unverified'
  | 'suspended'
  | 'archived'
  | 'locked'
  | 'password_change_required'

export type AccountStateCode =
  | 'ACCOUNT_UNVERIFIED'
  | 'ACCOUNT_UNAVAILABLE'
  | 'ACCOUNT_LOCKED'

export type AccountStateProfile = {
  email_verified_at?: string | null
  verification_status?: string | null
  is_deleted?: boolean | null
  locked_until?: string | null
  must_change_password?: boolean | null
}

const ARCHIVED_STATUSES = new Set(['deleted'])
// 'reset' has always blocked sign-in; keep it blocked (treated as unavailable).
const SUSPENDED_STATUSES = new Set(['disabled', 'reset', 'suspended'])

/**
 * Precedence: archived > suspended > unverified > locked > password_change_required > active.
 * Blocking administrative states win so an archived or suspended identity is
 * never told to "activate" (which it cannot do).
 */
export function classifyAccountState(
  profile: AccountStateProfile,
  now: Date = new Date(),
): AccountState {
  const status = String(profile.verification_status ?? '').toLowerCase()

  if (profile.is_deleted || ARCHIVED_STATUSES.has(status)) return 'archived'
  if (SUSPENDED_STATUSES.has(status)) return 'suspended'
  if (!profile.email_verified_at) return 'unverified'
  if (profile.locked_until && new Date(profile.locked_until) > now) return 'locked'
  if (profile.must_change_password) return 'password_change_required'
  return 'active'
}

export type AccountStateResponse = {
  status: number
  body: { error: string; code: AccountStateCode; activationRequired?: true }
}

/**
 * The response to return for a state that must block sign-in, or null when the
 * sign-in may continue (active / password_change_required, which is enforced by
 * the post-login redirect flow).
 */
export function accountStateResponse(state: AccountState): AccountStateResponse | null {
  switch (state) {
    case 'unverified':
      return {
        status: 403,
        body: { error: ACCOUNT_ACTIVATION_ERROR, code: 'ACCOUNT_UNVERIFIED', activationRequired: true },
      }
    case 'archived':
    case 'suspended':
      return { status: 403, body: { error: ACCOUNT_UNAVAILABLE_ERROR, code: 'ACCOUNT_UNAVAILABLE' } }
    case 'locked':
      return { status: 429, body: { error: ACCOUNT_LOCKED_ERROR, code: 'ACCOUNT_LOCKED' } }
    default:
      return null
  }
}

/**
 * True when the identity is activated and not administratively blocked.
 * Lockouts are intentionally ignored here (sessions/guards); sign-in routes
 * enforce lockouts separately.
 */
export function isAccountActivated(profile: AccountStateProfile): boolean {
  const state = classifyAccountState({ ...profile, locked_until: null })
  return state === 'active' || state === 'password_change_required'
}
