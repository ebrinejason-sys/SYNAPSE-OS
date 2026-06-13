import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyOTP, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'
import { SignJWT } from 'jose'

const ISSUER   = 'synapse-health-technologies'
const AUDIENCE = 'synapse-platform'
const MFA_COOKIE = 'synapse_mfa_pending'
const MFA_TTL_SECONDS = 300 // 5 minutes

function getJwtSecret(): Uint8Array {
  const s = process.env.SYNAPSE_JWT_SECRET
  if (!s) throw new Error('SYNAPSE_JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const otp   = typeof body.otp   === 'string' ? body.otp.trim()                : ''

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: 'email and 6-digit otp required' }, { status: 400 })
  }

  const result = await verifyOTP({ target: email, otp })

  if (!result.valid) {
    const messages: Record<string, string> = {
      NOT_FOUND: 'No active verification found. Request a new code.',
      EXPIRED: 'Code has expired. Request a new code.',
      INVALID: 'Incorrect code. Please try again.',
      TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
    }
    return NextResponse.json(
      { error: messages[result.error ?? 'INVALID'] ?? 'Verification failed.' },
      { status: result.error === 'TOO_MANY_ATTEMPTS' ? 429 : 401 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileErr } = await (supabaseAdmin as any)
    .from('profiles')
    .select('id, role, tenant_id, synapse_id')
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  const cookieStore = await cookies()

  // platform_admin requires TOTP as third factor
  if (profile.role === 'platform_admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrollment } = await (supabaseAdmin as any)
      .from('mfa_enrollments')
      .select('id, verified')
      .eq('user_id', profile.id)
      .eq('verified', true)
      .maybeSingle()

    const preAuthToken = await new SignJWT({ sub: profile.id, email, purpose: 'totp_pending' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(`${MFA_TTL_SECONDS}s`)
      .sign(getJwtSecret())

    const mfaCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: MFA_TTL_SECONDS,
      path: '/',
    }

    cookieStore.set(MFA_COOKIE, preAuthToken, mfaCookieOptions)

    if (enrollment) {
      return NextResponse.json({ mfaRequired: true })
    } else {
      return NextResponse.json({ mfaSetupRequired: true })
    }
  }

  // Non-platform_admin: issue full session immediately
  const token = await signToken({
    sub:        profile.id,
    email,
    role:       profile.role,
    tenant_id:  profile.tenant_id,
    app:        'web',
    synapse_id: profile.synapse_id ?? undefined,
  })

  await createSession({
    userId:    profile.id,
    token,
    app:       'web',
    ip:        req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('profiles')
    .update({ login_attempts: 0 })
    .eq('id', profile.id)

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
