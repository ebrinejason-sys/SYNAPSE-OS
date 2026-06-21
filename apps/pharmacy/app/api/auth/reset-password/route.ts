import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashPassword, validatePasswordStrength } from '@synapse/auth'

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
  }

  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.errors.join('. ') }, { status: 400 })
  }

  const tokenHash = await sha256Hex(token)

  const { data: resetToken } = await supabaseAdmin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!resetToken) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  if (resetToken.used_at) {
    return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 })
  }

  if (new Date(resetToken.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 })
  }

  const newHash = await hashPassword(newPassword)

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ password_hash: newHash, must_change_password: false })
    .eq('id', resetToken.user_id as string)

  if (updateError) {
    console.error('[reset-password] update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }

  // Mark token as used
  await supabaseAdmin
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', resetToken.id as string)

  // Also clear must_change_password in pharmacy_user_settings if present
  await supabaseAdmin
    .from('pharmacy_user_settings')
    .update({ must_change_password: false })
    .eq('profile_id', resetToken.user_id as string)

  return NextResponse.json({ ok: true })
}
