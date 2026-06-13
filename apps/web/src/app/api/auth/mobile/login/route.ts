import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, verifyPassword, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_DURATION_DAYS } from '@synapse/config/constants'

const MAX_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password                   : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select(`
      id, email, role, tenant_id, synapse_id,
      password_hash, login_attempts, locked_until,
      full_name, first_name, last_name, is_admin, must_change_password,
      verification_status, email_verified_at, is_deleted
    `)
    .eq('email', email)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    return NextResponse.json(
      { error: 'Account temporarily locked. Try again later.' },
      { status: 429 }
    )
  }

  const authenticated = profile.password_hash
    ? await verifyPassword(password, profile.password_hash)
    : false

  if (!authenticated) {
    const attempts = (profile.login_attempts ?? 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      const until = new Date()
      until.setMinutes(until.getMinutes() + LOCKOUT_MINUTES)
      await db
        .from('profiles')
        .update({ login_attempts: attempts, locked_until: until.toISOString() })
        .eq('id', profile.id)
    } else {
      await db
        .from('profiles')
        .update({ login_attempts: attempts })
        .eq('id', profile.id)
    }
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await db
    .from('profiles')
    .update({ login_attempts: 0, locked_until: null })
    .eq('id', profile.id)

  if (!isAccountActivated(profile)) {
    return NextResponse.json({ error: ACCOUNT_ACTIVATION_ERROR }, { status: 403 })
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
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  await createSession({
    userId: profile.id,
    token,
    app: 'mobile',
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

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
