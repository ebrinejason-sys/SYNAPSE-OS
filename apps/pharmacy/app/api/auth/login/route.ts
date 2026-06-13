import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createAndSendOTP } from '@synapse/auth'
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

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, tenant_id, synapse_id, password_hash, login_attempts, locked_until')
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

  const authenticated = profile.password_hash
    ? await verifyPassword(password, profile.password_hash as string)
    : false

  if (!authenticated) {
    const attempts = (profile.login_attempts as number ?? 0) + 1
    const updateData: { login_attempts: number; locked_until?: string } = { login_attempts: attempts }
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date()
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES)
      updateData.locked_until = lockedUntil.toISOString()
    }
    await supabaseAdmin.from('profiles').update(updateData).eq('id', profile.id as string)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await supabaseAdmin
    .from('profiles')
    .update({ login_attempts: 0, locked_until: null as unknown as string })
    .eq('id', profile.id as string)

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
