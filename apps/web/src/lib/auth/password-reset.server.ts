import { hashToken, signShortToken } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendPasswordResetEmail } from '@/lib/resend'

const RESET_TTL_MINUTES = 15

export type SendPasswordResetResult =
  | { ok: true; email: string }
  | { ok: false; error: string }

/**
 * Mint a password-reset link and email it. Used by public forgot-password and platform admin.
 */
export async function sendUserPasswordReset(params: {
  userId: string
  email: string
  name: string
  appUrl: string
  /** When true (admin-initiated), mark email verified so login works after reset */
  activateIfPending?: boolean
}): Promise<SendPasswordResetResult> {
  const db = supabaseAdmin as any
  const token = await signShortToken({ sub: params.userId, purpose: 'reset' })
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString()

  await db
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .is('used_at', null)

  const { error: tokenErr } = await db.from('password_reset_tokens').insert({
    user_id: params.userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  if (tokenErr) {
    console.error('[password-reset] token insert failed', tokenErr)
    return { ok: false, error: 'Failed to create reset link.' }
  }

  if (params.activateIfPending) {
    await db
      .from('profiles')
      .update({
        email_verified_at: new Date().toISOString(),
        verification_status: 'verified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.userId)
      .is('email_verified_at', null)
  }

  const resetUrl = `${params.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`

  try {
    await sendPasswordResetEmail(params.email, params.name, resetUrl)
  } catch (error) {
    await db.from('password_reset_tokens').delete().eq('token_hash', tokenHash)
    console.error('[password-reset] email failed', error)
    return { ok: false, error: 'Failed to send reset email.' }
  }

  return { ok: true, email: params.email }
}
