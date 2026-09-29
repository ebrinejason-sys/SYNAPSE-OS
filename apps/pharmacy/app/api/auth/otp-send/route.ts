import { NextRequest, NextResponse } from 'next/server'
import { createAndSendOTP, isAccountActivated } from '@synapse/auth'
import { sendOTP } from '@synapse/email'
import { supabaseAdmin } from '@synapse/db/admin'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Generated DB types lag the profiles columns used here; same cast as auth/login/route.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabaseAdmin as any)
    .from('profiles')
    .select('full_name, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .single()

  // Don't reveal whether the account exists, and never issue a sign-in code to an
  // archived, suspended, or unactivated identity (same response either way).
  if (!profile || !isAccountActivated(profile)) {
    return NextResponse.json({ ok: true })
  }

  try {
    const otp = await createAndSendOTP({ channel: 'email', target: email })
    await sendOTP({
      to:      email,
      name:    (profile.full_name as string | null) ?? email,
      otp,
      purpose: 'login',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting a new code.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
