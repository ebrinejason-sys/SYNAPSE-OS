import { NextResponse } from 'next/server'
import { trySendActivationEmail } from './activation-email'

/**
 * Public signup responses are anti-enumeration: a new email, an existing
 * unverified/verified/archived/suspended email, and a delivery failure all
 * return exactly this body with status 200. No userId is ever returned.
 */
export const SIGNUP_ACCEPTED_BODY = { ok: true, activationRequired: true } as const

export function signupAccepted() {
  return NextResponse.json(SIGNUP_ACCEPTED_BODY, { status: 200 })
}

const NON_RESENDABLE_STATUSES = new Set(['deleted', 'disabled', 'suspended', 'reset'])

type ExistingProfile = {
  id?: unknown
  email?: unknown
  full_name?: unknown
  first_name?: unknown
  verification_status?: unknown
  email_verified_at?: unknown
  is_deleted?: unknown
}

/**
 * Existing account on signup: re-send the activation email only if the account
 * is genuinely pending activation. Verified, archived and suspended accounts get
 * nothing (no "already registered" signal). Callers always answer signupAccepted().
 */
export async function handleExistingAccountSignup({
  db,
  existing,
  origin,
  logContext,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  existing: ExistingProfile
  origin: string
  logContext: string
}): Promise<void> {
  const status = String(existing.verification_status ?? '').toLowerCase()
  const pending =
    !existing.email_verified_at &&
    !existing.is_deleted &&
    typeof existing.email === 'string' &&
    Boolean(existing.email) &&
    !NON_RESENDABLE_STATUSES.has(status)

  if (!pending) return

  const emailResult = await trySendActivationEmail({
    origin,
    userId: existing.id as string,
    email: existing.email as string,
    name: (existing.full_name as string | null) ?? (existing.first_name as string | null) ?? 'there',
    logContext,
  })

  if (emailResult.sent) {
    await db
      .from('profiles')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('id', existing.id as string)
  }
}
