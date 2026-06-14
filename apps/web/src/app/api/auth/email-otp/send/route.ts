import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, createAndSendOTP } from '@synapse/auth'
import { createServiceClient } from '../../../../../lib/supabase/server'
import { sendOtpEmail } from '../../../../../lib/resend'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const db = createServiceClient() as any

  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .maybeSingle()

  if (profileErr) {
    console.error('email otp profile lookup error:', profileErr.message)
    return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ ok: true })
  }

  if (!isAccountActivated(profile)) {
    return NextResponse.json({ error: ACCOUNT_ACTIVATION_ERROR }, { status: 403 })
  }

  let otp: string
  try {
    otp = await createAndSendOTP({ channel: 'email', target: email })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before requesting another code.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to create verification' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (err) {
    console.error('Email OTP send error:', err)
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
