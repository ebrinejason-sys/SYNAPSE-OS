// Server-verifiable "recent MFA" assurance, built on the existing
// mfa_enrollments table (see packages/auth/src/totp.ts and
// apps/web/src/app/api/auth/mfa/*). No new token format: recency is proven
// by a durable, server-written session timestamp (mfa_assured_at), not by a claim the
// caller presents. A capability like tenant.manage authorizes an action; it
// is not evidence that the caller recently proved possession of their
// authenticator, which is what destructive actions additionally require.

import { supabaseAdmin } from '@synapse/db/admin'
import { matchingTotpTimeStep } from './totp'

export const DESTRUCTIVE_ACTION_MFA_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

/** True only for this user's live session with recent server-recorded assurance. */
export async function hasRecentVerifiedMfa(
  userId: string,
  sessionId: string,
  maxAgeMs: number = DESTRUCTIVE_ACTION_MFA_MAX_AGE_MS,
): Promise<boolean> {
  if (!userId || !sessionId) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('synapse_sessions')
    .select('user_id, expires_at, revoked_at, mfa_assured_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data || data.revoked_at || new Date(data.expires_at as string) <= new Date() || !data.mfa_assured_at) return false
  const ageMs = Date.now() - new Date(data.mfa_assured_at as string).getTime()
  return ageMs >= 0 && ageMs <= maxAgeMs
}

export type StepUpMfaResult =
  | { ok: true }
  | { ok: false; code: 'NOT_ENROLLED' | 'INVALID_CODE' | 'REPLAYED_CODE' | 'ENROLLMENT_READ_FAILED' | 'ASSURANCE_WRITE_FAILED' }

/**
 * Explicit step-up: verifies a fresh TOTP code against the user's existing
 * enrollment and, on success, stamps the session's mfa_assured_at so a subsequent
 * hasRecentVerifiedMfa check within maxAgeMs succeeds. This reuses the exact
 * authenticator/secret already established by the ordinary MFA enrollment
 * flow — no separate destructive-action credential is introduced.
 */
export async function verifyStepUpMfa(userId: string, sessionId: string, code: string): Promise<StepUpMfaResult> {
  if (!userId || !sessionId) return { ok: false, code: 'ASSURANCE_WRITE_FAILED' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: session, error: sessionError } = await db
    .from('synapse_sessions')
    .select('user_id, expires_at, revoked_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (sessionError || !session || session.revoked_at || new Date(session.expires_at as string) <= new Date()) return { ok: false, code: 'ASSURANCE_WRITE_FAILED' }

  const { data: enrollment, error: enrollmentError } = await db
    .from('mfa_enrollments')
    .select('id, secret')
    .eq('user_id', userId)
    .eq('verified', true)
    .maybeSingle()

  if (enrollmentError) return { ok: false, code: 'ENROLLMENT_READ_FAILED' }
  if (!enrollment) return { ok: false, code: 'NOT_ENROLLED' }

  const matchedStep = await matchingTotpTimeStep(enrollment.secret as string, code)
  if (matchedStep === null) return { ok: false, code: 'INVALID_CODE' }

  // Global per-code single-use: the exact time-step that matched can never be
  // redeemed again by this enrollment, in this session or any other.
  const { error: replayError } = await db.from('mfa_step_up_replays').insert({ session_id: sessionId, enrollment_id: enrollment.id, time_step: matchedStep })
  if (replayError) {
    if (replayError.code === '23505') return { ok: false, code: 'REPLAYED_CODE' }
    return { ok: false, code: 'ASSURANCE_WRITE_FAILED' }
  }
  const now = new Date().toISOString()
  const { data: assuredSession, error: assuranceError } = await db.from('synapse_sessions')
    .update({ mfa_assured_at: now }).eq('id', sessionId).eq('user_id', userId)
    .is('revoked_at', null).gt('expires_at', now).select('id').maybeSingle()
  if (assuranceError || !assuredSession) return { ok: false, code: 'ASSURANCE_WRITE_FAILED' }
  return { ok: true }
}
