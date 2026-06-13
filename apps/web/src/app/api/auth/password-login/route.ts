import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, hashPassword } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { generateOtp, hashOtp } from '../../../../lib/otp'
import { sendOtpEmail } from '../../../../lib/resend'

const MAX_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30
const OTP_RATE_LIMIT = 3
const OTP_TTL_MIN = 10

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : ''
  const password = typeof body.password === 'string' ? body.password                      : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, email, role, tenant_id, synapse_id, password_hash, login_attempts, locked_until')
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (profile.locked_until && new Date(profile.locked_until as string) > new Date()) {
    return NextResponse.json(
      { error: 'Account temporarily locked. Try again later.' },
      { status: 429 }
    )
  }

  let authenticated = false

  if (profile.password_hash) {
    authenticated = await verifyPassword(password, profile.password_hash as string)
  } else {
    // Lazy migration: fall back to Supabase Auth, then store bcrypt hash
    const { error: supabaseErr } = await supabaseAdmin.auth.signInWithPassword({ email, password })
    if (!supabaseErr) {
      authenticated = true
      const hashed = await hashPassword(password)
      await db.from('profiles').update({ password_hash: hashed }).eq('id', profile.id as string)
    }
  }

  if (!authenticated) {
    const attempts = (profile.login_attempts as number ?? 0) + 1
    const updateData: Record<string, unknown> = { login_attempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date()
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES)
      updateData['locked_until'] = lockedUntil.toISOString()
    }
    await db.from('profiles').update(updateData).eq('id', profile.id as string)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await db
    .from('profiles')
    .update({ login_attempts: 0, locked_until: null as unknown as string })
    .eq('id', profile.id as string)

  // Password verified — gate with email OTP as second factor
  const { count } = await supabaseAdmin
    .from('auth_otps')
    .select('*', { count: 'exact', head: true })
    .eq('target', email)
    .eq('channel', 'email')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if ((count ?? 0) >= OTP_RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Too many verification requests. Please wait before trying again.' },
      { status: 429 }
    )
  }

  const otp      = generateOtp()
  const otpHash  = hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString()

  const { error: insertErr } = await supabaseAdmin
    .from('auth_otps')
    .insert({ channel: 'email', target: email, otp_hash: otpHash, expires_at: expiresAt })

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to create verification code.' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch {
    return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 })
  }

  return NextResponse.json({ otpSent: true })
}
