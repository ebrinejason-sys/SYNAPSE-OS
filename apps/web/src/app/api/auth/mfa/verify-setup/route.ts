import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { supabaseAdmin } from '@synapse/db/admin'
import { signToken, createSession, verifyTotp } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

const ISSUER     = 'synapse-health-technologies'
const AUDIENCE   = 'synapse-platform'
const MFA_COOKIE = 'synapse_mfa_pending'

function getJwtSecret(): Uint8Array {
  const s = process.env.SYNAPSE_JWT_SECRET
  if (!s) throw new Error('SYNAPSE_JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: '6-digit code required' }, { status: 400 })
  }

  const cookieStore  = await cookies()
  const pendingToken = cookieStore.get(MFA_COOKIE)?.value

  if (!pendingToken) {
    return NextResponse.json({ error: 'MFA session expired. Please log in again.' }, { status: 401 })
  }

  let userId: string
  let email: string
  try {
    const { payload } = await jwtVerify(pendingToken, getJwtSecret(), { issuer: ISSUER, audience: AUDIENCE })
    if (payload['purpose'] !== 'totp_pending') throw new Error('wrong purpose')
    userId = payload.sub as string
    email  = payload['email'] as string
  } catch {
    return NextResponse.json({ error: 'MFA session invalid. Please log in again.' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollment } = await (supabaseAdmin as any)
    .from('mfa_enrollments')
    .select('id, secret')
    .eq('user_id', userId)
    .eq('verified', false)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'No pending enrollment found. Start setup again.' }, { status: 404 })
  }

  const valid = await verifyTotp(enrollment.secret as string, code)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect code. Check your authenticator app.' }, { status: 401 })
  }

  // Mark enrollment as verified
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('mfa_enrollments')
    .update({ verified: true, last_used_at: new Date().toISOString() })
    .eq('id', enrollment.id)

  // Fetch full profile to issue session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabaseAdmin as any)
    .from('profiles')
    .select('id, role, tenant_id, synapse_id')
    .eq('id', userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  const token = await signToken({
    sub:        profile.id,
    email,
    role:       profile.role,
    tenant_id:  profile.tenant_id ?? '',
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

  // Clear pre-auth cookie, set full session
  cookieStore.delete(MFA_COOKIE)
  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path:     '/',
  })

  return NextResponse.json({ ok: true })
}
