import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'

export const dynamic = 'force-dynamic'

/**
 * Mobile forgot-password. Always returns ok (no email enumeration).
 * Emails the same reset link used by the web app; the native app can also
 * complete the reset via /api/auth/mobile/reset-password when opened with a token.
 */
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.synapseos.tech'
    const name =
      (profile.full_name as string | null) ??
      (profile.first_name as string | null) ??
      'there'

    const result = await sendUserPasswordReset({
      userId: profile.id as string,
      email: profile.email as string,
      name,
      appUrl,
    })

    if (!result.ok) {
      console.error('[mobile/forgot-password]', result.error)
      // Still return ok to avoid enumeration; user can retry.
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  })
}
