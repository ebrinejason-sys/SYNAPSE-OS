import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
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
      // Never surface delivery failures to the caller: a 500 only for existing
      // accounts is an account-enumeration oracle. Log for operators instead.
      console.error('[auth/password-reset/request] reset delivery failed', { error: result.error })
    }
  }

  return NextResponse.json({ ok: true })
}
