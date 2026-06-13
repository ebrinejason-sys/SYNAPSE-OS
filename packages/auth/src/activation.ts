export const ACCOUNT_ACTIVATION_ERROR =
  'Activate your account from the email we sent before signing in.'

const BLOCKED_STATUSES = new Set(['deleted', 'disabled', 'reset', 'suspended'])

export function isAccountActivated(profile: {
  email_verified_at?: string | null
  verification_status?: string | null
  is_deleted?: boolean | null
}): boolean {
  if (profile.is_deleted) return false

  const status = (profile.verification_status ?? '').toLowerCase()
  if (BLOCKED_STATUSES.has(status)) return false

  return Boolean(profile.email_verified_at)
}
