import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_DURATION_DAYS } from '@synapse/config/constants'

const MOBILE_SESSION_DAYS = 3

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const otp = typeof body.otp === 'string' ? body.otp.trim() : ''

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

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select(`
      id, email, role, tenant_id, synapse_id,
      full_name, first_name, last_name, is_admin, must_change_password,
      email_verified_at, is_deleted
    `)
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  const token = await signToken({
    sub: profile.id,
    email,
    role: profile.role,
    tenant_id: profile.tenant_id ?? '',
    app: 'mobile',
    synapse_id: profile.synapse_id ?? undefined,
  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + MOBILE_SESSION_DAYS)

  await createSession({
    userId: profile.id,
    token,
    app: 'mobile',
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  await db.from('profiles').update({ login_attempts: 0 }).eq('id', profile.id)

  const { data: tenant } = await db
    .from('tenants')
    .select('name')
    .eq('id', profile.tenant_id ?? '')
    .maybeSingle()

  const joinedName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const fullName = (profile.full_name as string | null) ?? (joinedName || null)

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: profile.id,
      email,
      role: profile.role,
      fullName,
      tenantId: profile.tenant_id ?? '',
      tenantName: (tenant?.name as string | null) ?? '',
      isAdmin: (profile.is_admin as boolean | null) ?? false,
      mustChangePassword: (profile.must_change_password as boolean | null) ?? false,
    },
  })
}
