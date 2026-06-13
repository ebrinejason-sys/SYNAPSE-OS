import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated } from '@synapse/auth'
import { createServiceClient } from '../../../../../lib/supabase/server'
import { generateOtp, hashOtp } from '../../../../../lib/otp'
import { sendOtpEmail } from '../../../../../lib/resend'

const RATE_LIMIT = 3
const OTP_TTL_MIN = 10

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

  const { count } = await db
    .from('auth_otps')
    .select('*', { count: 'exact', head: true })
    .eq('target', email)
    .eq('channel', 'email')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before requesting another code.' },
      { status: 429 }
    )
  }

  const otp     = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString()

  const { data: otpRow, error: insertErr } = await db
    .from('auth_otps')
    .insert({ channel: 'email', target: email, otp_hash: otpHash, expires_at: expiresAt })
    .select('id')
    .single()

  if (insertErr) {
    console.error('auth_otps insert error:', insertErr.message)
    return NextResponse.json({ error: 'Failed to create verification' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (err) {
    if (otpRow?.id) {
      await db.from('auth_otps').delete().eq('id', otpRow.id as string)
    }
    console.error('Email OTP send error:', err)
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
