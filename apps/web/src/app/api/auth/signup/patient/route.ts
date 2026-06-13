import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, signShortToken, validatePasswordStrength } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendActivationEmail } from '../../../../../lib/resend'

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
      .select('id, email, full_name, first_name, verification_status, email_verified_at')
      .eq('email', email)
      .maybeSingle()

    if (existingErr) {
      console.error('[auth/signup/patient] existing lookup failed', existingErr)
      return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
    }

    if (existing) {
      const existingStatus = String(existing.verification_status ?? '').toLowerCase()
      const canResendActivation =
        !existing.email_verified_at &&
        existing.email &&
        !['deleted', 'disabled', 'suspended'].includes(existingStatus)

      if (canResendActivation) {
        const token = await signShortToken({ sub: existing.id as string, purpose: 'verify' }, '24h')
        const activationUrl = `${req.nextUrl.origin}/api/auth/activate?token=${encodeURIComponent(token)}`
        await db
          .from('profiles')
          .update({ activation_sent_at: new Date().toISOString() })
          .eq('id', existing.id as string)
        await sendActivationEmail(
          existing.email as string,
          (existing.full_name as string | null) ?? (existing.first_name as string | null) ?? 'there',
          activationUrl
        )
        return NextResponse.json({ ok: true, userId: existing.id, activationRequired: true })
      }

      return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 })
    }

    userId = randomUUID()
    const fullName = `${firstName} ${lastName}`.trim()
    const passwordHash = await hashPassword(password)
    const now = new Date().toISOString()

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
      password_changed_at: now,
      onboarding_complete: false,
      verification_status: 'pending',
      email_verified_at: null,
      activation_sent_at: now,
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

    const token = await signShortToken({ sub: userId, purpose: 'verify' }, '24h')
    const activationUrl = `${req.nextUrl.origin}/api/auth/activate?token=${encodeURIComponent(token)}`

    try {
      await sendActivationEmail(email, fullName, activationUrl)
    } catch (emailErr) {
      console.error('[auth/signup/patient] activation email failed', emailErr)
      await db.from('patient_profiles').delete().eq('id', userId)
      await db.from('profiles').delete().eq('id', userId)
      return NextResponse.json(
        { error: 'Could not send activation email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, userId, activationRequired: true })
  } catch (error) {
    console.error('[auth/signup/patient] unexpected failure', error)

    if (userId) {
      await (supabaseAdmin as any).from('patient_profiles').delete().eq('id', userId)
      await (supabaseAdmin as any).from('profiles').delete().eq('id', userId)
    }

    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
  }
}
