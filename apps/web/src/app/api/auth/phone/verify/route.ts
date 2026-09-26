import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { accountStateResponse, classifyAccountState, verifyOTP, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const otp   = typeof body.otp   === 'string' ? body.otp.trim()   : ''

  if (!phone || !otp || otp.length !== 6) {
    return NextResponse.json({ error: 'phone and 6-digit otp required' }, { status: 400 })
  }

  const result = await verifyOTP({ target: phone, otp })

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

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, role, tenant_id, email, verification_status, email_verified_at, is_deleted')
    .eq('phone', phone)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: 'No Synapse OS account is linked to this phone number. Contact your hospital administrator.' },
      { status: 404 }
    )
  }

  // Credential proven above: state-specific responses are safe to return now.
  const blockedState = accountStateResponse(classifyAccountState({ ...profile, locked_until: null }))
  if (blockedState) {
    return NextResponse.json(blockedState.body, { status: blockedState.status })
  }

  const token = await signToken({
    sub: profile.id as string,
    email: profile.email as string,
    role: profile.role as string,
    tenant_id: profile.tenant_id as string,
    app: 'web',
  })

  await createSession({
    userId: profile.id as string,
    token,
    app: 'web',
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  await db
    .from('profiles')
    .update({ login_attempts: 0 })
    .eq('id', profile.id)

  const cookieStore = await cookies()
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
