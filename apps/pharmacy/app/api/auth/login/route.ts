import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, verifyPassword, createAndSendOTP } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendOTP } from '@synapse/email'

const MAX_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password                   : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT_SET'
  console.log('[login] supabase_url:', supabaseUrl.slice(0, 40), '| char0:', supabaseUrl.charCodeAt(0), '| email:', email)

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, email, full_name, role, tenant_id, synapse_id, password_hash, login_attempts, locked_until, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .single()

  console.log('[login] profile_found:', !!profile, '| db_error:', profileErr?.message ?? null, '| has_hash:', !!(profile?.password_hash))
  if (profileErr) console.error('[login] db_error_detail:', JSON.stringify(profileErr))

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (profile.locked_until && new Date(profile.locked_until as string) > new Date()) {
    return NextResponse.json(
      { error: 'Account temporarily locked. Try again later.' },
      { status: 429 }
    )
  }

  const authenticated = profile.password_hash
    ? await verifyPassword(password, profile.password_hash as string)
    : false

  console.log('[login] password_verified:', authenticated, '| hash_prefix:', String(profile.password_hash ?? '').slice(0, 7))

  if (!authenticated) {
    const attempts = (profile.login_attempts as number ?? 0) + 1
    const updateData: { login_attempts: number; locked_until?: string } = { login_attempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date()
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES)
      updateData.locked_until = lockedUntil.toISOString()
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

  // Password verified — gate with email OTP as second factor
  try {
    const otp = await createAndSendOTP({ channel: 'email', target: email })
    await sendOTP({
      to: email,
      name: (profile.full_name as string | null) ?? email,
      otp,
      purpose: 'login',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json(
        { error: 'Too many verification requests. Please wait before trying again.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 })
  }

  return NextResponse.json({ otpSent: true })
}
