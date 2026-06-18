import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, hashToken, revokeAllUserSessions, validatePasswordStrength, verifyShortToken } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!token || !password) {
    return NextResponse.json({ error: 'Reset token and password are required.' }, { status: 400 })
  }

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.errors[0] ?? 'Password is not strong enough.' }, { status: 400 })
  }

  let payload
  try {
    payload = await verifyShortToken(token, 'reset')
  } catch {
    return NextResponse.json({ error: 'This reset link is invalid or expired.' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const tokenHash = hashToken(token)
  const now = new Date().toISOString()
  const { data: resetToken, error: tokenErr } = await db
    .from('password_reset_tokens')
    .update({ used_at: now })
    .eq('token_hash', tokenHash)
    .eq('user_id', payload.sub)
    .is('used_at', null)
    .gte('expires_at', now)
    .select('id, user_id')
    .maybeSingle()

  if (
    tokenErr ||
    !resetToken
  ) {
    return NextResponse.json({ error: 'This reset link is invalid or expired.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const { error } = await (supabaseAdmin as any)
    .from('profiles')
    .update({
      password_hash: passwordHash,
      password_changed_at: new Date().toISOString(),
      login_attempts: 0,
      locked_until: null,
      must_change_password: false,
      email_verified_at: new Date().toISOString(),
      verification_status: 'verified',
    })
    .eq('id', payload.sub)

  if (error) {
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 })
  }

  await revokeAllUserSessions(payload.sub).catch(() => {})

  return NextResponse.json({ ok: true })
}
