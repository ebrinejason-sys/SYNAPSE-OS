import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyPassword, hashPassword, signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

const MAX_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password                   : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
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
    // Lazy migration: user hasn't set a custom password yet — fall back to Supabase Auth
    const { error: supabaseErr } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })
    if (!supabaseErr) {
      authenticated = true
      // Migrate: store the bcrypt hash so next login uses our system
      const hashed = await hashPassword(password)
      await supabaseAdmin
        .from('profiles')
        .update({ password_hash: hashed })
        .eq('id', profile.id as string)
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
    await supabaseAdmin.from('profiles').update(updateData).eq('id', profile.id as string)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await supabaseAdmin
    .from('profiles')
    .update({ login_attempts: 0, locked_until: null as unknown as string })
    .eq('id', profile.id as string)

  const token = await signToken({
    sub: profile.id as string,
    email,
    role: profile.role as string,
    tenant_id: profile.tenant_id as string,
    app: 'pharmacy',
    synapse_id: (profile.synapse_id as string | null) ?? undefined,
  })

  await createSession({
    userId: profile.id as string,
    token,
    app: 'pharmacy',
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

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
