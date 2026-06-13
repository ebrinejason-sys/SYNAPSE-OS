import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSession, hashPassword, signToken, validatePasswordStrength } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendWelcomeEmail } from '../../../../../lib/resend'

export async function POST(req: NextRequest) {
  let userId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : ''
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const dob = typeof body.dob === 'string' ? body.dob : ''
    const gender = typeof body.gender === 'string' ? body.gender : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors[0] ?? 'Password is not strong enough.' }, { status: 400 })
    }

    const db = supabaseAdmin as any
    const { data: existing, error: existingErr } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingErr) {
      console.error('[auth/signup/patient] existing lookup failed', existingErr)
      return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 })
    }

    userId = randomUUID()
    const fullName = `${firstName} ${lastName}`.trim()
    const passwordHash = await hashPassword(password)

    const { error: profileErr } = await db.from('profiles').insert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email,
      phone: phone || null,
      gender: gender || null,
      date_of_birth: dob || null,
      role: 'patient',
      password_hash: passwordHash,
      password_changed_at: new Date().toISOString(),
      onboarding_complete: false,
      verification_status: 'verified',
      app_user: true,
    })

    if (profileErr) {
      console.error('[auth/signup/patient] profile insert failed', profileErr)
      return NextResponse.json({ error: profileErr.message ?? 'Could not create account.' }, { status: 500 })
    }

    const { error: patientErr } = await db.from('patient_profiles').upsert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      phone: phone || null,
      date_of_birth: dob || null,
      sex: gender || null,
    })

    if (patientErr) {
      console.error('[auth/signup/patient] patient profile upsert failed', patientErr)
      await db.from('patient_profiles').delete().eq('id', userId)
      await db.from('profiles').delete().eq('id', userId)
      return NextResponse.json({ error: patientErr.message ?? 'Could not create patient profile.' }, { status: 500 })
    }

    const token = await signToken({
      sub: userId,
      email,
      role: 'patient',
      tenant_id: '',
      app: 'web',
    })

    await createSession({
      userId,
      token,
      app: 'web',
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const res = NextResponse.json({ ok: true, userId })
    const expires = new Date()
    expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires,
    })

    await sendWelcomeEmail(email, fullName).catch((emailErr) => {
      console.error('[auth/signup/patient] welcome email failed', emailErr)
    })

    return res
  } catch (error) {
    console.error('[auth/signup/patient] unexpected failure', error)

    if (userId) {
      await (supabaseAdmin as any).from('patient_profiles').delete().eq('id', userId)
      await (supabaseAdmin as any).from('profiles').delete().eq('id', userId)
    }

    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
  }
}
