import { NextRequest, NextResponse } from 'next/server'
import { signShortToken } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendPasswordResetEmail } from '../../../../../lib/resend'

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
    const origin = req.nextUrl.origin
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`
    const name = (profile.full_name as string | null) ?? (profile.first_name as string | null) ?? 'there'
    await sendPasswordResetEmail(profile.email as string, name, resetUrl).catch((error) => {
      console.error('[auth/password-reset/request] reset email failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return NextResponse.json({ ok: true })
}
