import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const otp   = typeof body.otp   === 'string' ? body.otp.trim()                 : ''

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: 'email and 6-digit otp required' }, { status: 400 })
  }

  const result = await verifyOTP({ target: email, otp })

  if (!result.valid) {
    const messages: Record<string, string> = {
      NOT_FOUND:         'No active verification found. Request a new code.',
      EXPIRED:           'Code has expired. Request a new code.',
      INVALID:           'Incorrect code. Please try again.',
      TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
    }
    return NextResponse.json(
      { error: messages[result.error ?? 'INVALID'] ?? 'Verification failed.' },
      { status: result.error === 'TOO_MANY_ATTEMPTS' ? 429 : 401 }
    )
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, tenant_id, synapse_id, must_change_password, onboarding_complete')
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  const token = await signToken({
    sub:       profile.id as string,
    email,
    role:      profile.role as string,
    tenant_id: (profile.tenant_id as string | null) ?? '',
    app:       'pharmacy',
    synapse_id:(profile.synapse_id as string | null) ?? undefined,
  })

  await createSession({
    userId:    profile.id as string,
    token,
    app:       'pharmacy',
    ip:        req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  await supabaseAdmin
    .from('profiles')
    .update({ login_attempts: 0 })
    .eq('id', profile.id as string)

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  const role = String(profile.role ?? '')
  let redirect = '/portal/dashboard'
  if (profile.must_change_password) {
    redirect = '/change-password'
  } else if (role === 'cashier') {
    redirect = '/portal/pos'
  }
  // Do not force /onboarding here — middleware + tenant/profile flags own that gate.
  // Platform-provisioned pharmacies are already marked complete before first login.

  const response = NextResponse.json({
    ok: true,
    mustChangePassword: Boolean(profile.must_change_password),
    role,
    redirect,
  })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path:     '/',
  })

  return response
}
