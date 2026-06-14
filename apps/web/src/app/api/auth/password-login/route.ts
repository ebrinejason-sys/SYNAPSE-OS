import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, verifyPassword, createAndSendOTP } from '@synapse/auth'
import { signMfaPendingToken, mfaCookieOptions, MFA_PENDING_COOKIE } from '@synapse/auth/mfa'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendOtpEmail } from '../../../../lib/resend'

const MAX_ATTEMPTS    = 10
const LOCKOUT_MINUTES = 30

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
    .select('id, email, role, tenant_id, synapse_id, password_hash, login_attempts, locked_until, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (profile.locked_until && new Date(profile.locked_until as string) > new Date()) {
    return NextResponse.json({ error: 'Account temporarily locked. Try again later.' }, { status: 429 })
  }

  const authenticated = profile.password_hash
    ? await verifyPassword(password, profile.password_hash as string)
    : false

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

  if (!isAccountActivated(profile)) {
    return NextResponse.json({ error: ACCOUNT_ACTIVATION_ERROR }, { status: 403 })
  }

  // platform_admin: if MFA is already enrolled, skip OTP and go straight to TOTP
  if (profile.role === 'platform_admin') {
    const { data: enrollment } = await db
      .from('mfa_enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('verified', true)
      .maybeSingle()

    if (enrollment) {
      const preAuthToken = await signMfaPendingToken({
        sub: profile.id as string,
        email: profile.email as string,
      })

      // Set cookie directly on response — cookies().set() does not propagate in Next.js 15 Route Handlers
      const r = NextResponse.json({ mfaRequired: true })
      r.cookies.set(MFA_PENDING_COOKIE, preAuthToken, mfaCookieOptions)
      return r
    }
    // No MFA enrolled yet — fall through to OTP for initial setup
  }

  let otp: string
  try {
    otp = await createAndSendOTP({ channel: 'email', target: email })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json(
        { error: 'Too many verification requests. Please wait before trying again.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to create verification code.' }, { status: 500 })
  }

  try {
    await sendOtpEmail(email, otp)
  } catch (error) {
    console.error('[auth/password-login] otp email failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ otpSent: true })
}
