import { NextRequest, NextResponse } from 'next/server'
import { hashToken, signShortToken } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendPasswordResetEmail } from '../../../../../lib/resend'

const RESET_TTL_MINUTES = 15

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    return NextResponse.json({ ok: true })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, first_name')
    .eq('email', email)
    .maybeSingle()

  if (profile?.id && profile.email) {
    const token = await signShortToken({ sub: profile.id as string, purpose: 'reset' })
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString()

    const db = supabaseAdmin as any
    await db
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', profile.id as string)
      .is('used_at', null)

    const { error: tokenErr } = await db
      .from('password_reset_tokens')
      .insert({
        user_id: profile.id as string,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

    if (tokenErr) {
      console.error('[auth/password-reset/request] token insert failed', tokenErr)
      return NextResponse.json({ error: 'Failed to create reset link. Please try again.' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
    const name = (profile.full_name as string | null) ?? (profile.first_name as string | null) ?? 'there'
    try {
      await sendPasswordResetEmail(profile.email as string, name, resetUrl)
    } catch (error) {
      await db.from('password_reset_tokens').delete().eq('token_hash', tokenHash)
      console.error('[auth/password-reset/request] reset email failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Failed to send reset email. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
