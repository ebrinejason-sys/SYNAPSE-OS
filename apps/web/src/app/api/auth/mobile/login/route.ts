import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, verifyPassword, createAndSendOTP } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendOtpEmail } from '@/lib/resend'

const MAX_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30

/** Step 1: password verify → email OTP (no session until otp-verify). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, email, password_hash, login_attempts, locked_until, email_verified_at, is_deleted')
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    return NextResponse.json({ error: 'Account temporarily locked. Try again later.' }, { status: 429 })
  }

  const authenticated = profile.password_hash
    ? await verifyPassword(password, profile.password_hash)
    : false

  if (!authenticated) {
    const attempts = (profile.login_attempts ?? 0) + 1
    const update: Record<string, unknown> = { login_attempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      const until = new Date()
      until.setMinutes(until.getMinutes() + LOCKOUT_MINUTES)
      update.locked_until = until.toISOString()
    }
    await db.from('profiles').update(update).eq('id', profile.id)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await db.from('profiles').update({ login_attempts: 0, locked_until: null }).eq('id', profile.id)

  if (!isAccountActivated(profile)) {
    return NextResponse.json({ error: ACCOUNT_ACTIVATION_ERROR }, { status: 403 })
  }

  let otp: string
  try {
    otp = await createAndSendOTP({ channel: 'email', target: email })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json({ error: 'Too many verification requests. Please wait.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Failed to create verification code.' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (error) {
    console.error('[auth/mobile/login] otp email failed', error)
    return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 })
  }

  return NextResponse.json({ otpSent: true })
}
