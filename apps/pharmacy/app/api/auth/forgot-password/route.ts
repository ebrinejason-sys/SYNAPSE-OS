import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendPasswordReset } from '@synapse/email'

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Always return success to avoid leaking whether an email exists
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email)
    .maybeSingle()

  if (profile) {
    // Generate a cryptographically secure 32-byte token
    const rawBytes = crypto.getRandomValues(new Uint8Array(32))
    const token = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const tokenHash = await sha256Hex(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Invalidate any existing unused tokens for this user
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('used_at', null)

    const { error: insertError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: profile.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })

    if (!insertError) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (request.headers.get('x-forwarded-host')
          ? `https://${request.headers.get('x-forwarded-host')}`
          : `https://${request.headers.get('host') ?? 'pharm.synapseos.tech'}`)

      const resetUrl = `${appUrl}/reset-password/${token}`

      await sendPasswordReset({
        to: profile.email as string,
        name: (profile.full_name as string | null) ?? email,
        resetUrl,
      }).catch((err) => {
        console.error('[forgot-password] email send failed:', err)
      })
    }
  }

  return NextResponse.json({ ok: true })
}
