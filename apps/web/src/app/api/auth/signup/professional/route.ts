import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, validatePasswordStrength } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { activationResponse, trySendActivationEmail } from '../../../../../lib/auth/activation-email'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : ''
  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const gender = typeof body.gender === 'string' ? body.gender : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const specialty = typeof body.specialty === 'string' ? body.specialty : ''
  const licenseNumber = typeof body.license_number === 'string' ? body.license_number.trim() : ''
  const yearsExperience = Number.parseInt(String(body.years_experience ?? '0'), 10) || 0
  const licenseB64 = typeof body.license_b64 === 'string' ? body.license_b64 : ''
  const licenseMime = typeof body.license_mime === 'string' ? body.license_mime : ''

  if (!firstName || !lastName || !email || !password || !specialty || !licenseNumber) {
    return NextResponse.json({ error: 'Required professional signup details are missing.' }, { status: 400 })
  }

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.errors[0] ?? 'Password is not strong enough.' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('profiles')
    .select('id, email, full_name, first_name, verification_status, email_verified_at')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    const existingStatus = String(existing.verification_status ?? '').toLowerCase()
    const canResendActivation =
      !existing.email_verified_at &&
      existing.email &&
      !['deleted', 'disabled', 'suspended'].includes(existingStatus)

    if (canResendActivation) {
      const emailResult = await trySendActivationEmail({
        origin: req.nextUrl.origin,
        userId: existing.id as string,
        email: existing.email as string,
        name: (existing.full_name as string | null) ?? (existing.first_name as string | null) ?? 'there',
        logContext: 'auth/signup/professional',
      })

      if (emailResult.sent) {
        await db
          .from('profiles')
          .update({ activation_sent_at: new Date().toISOString() })
          .eq('id', existing.id as string)
      }

      return NextResponse.json(
        activationResponse({ userId: existing.id as string, emailSent: emailResult.sent }),
        { status: emailResult.sent ? 200 : 202 }
      )
    }

    return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 })
  }

  const userId = randomUUID()
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
    role: 'clinician',
    specialty_confirmed: specialty,
    license_number: licenseNumber,
    years_experience: yearsExperience,
    password_hash: passwordHash,
    password_changed_at: now,
    verification_status: 'pending',
    email_verified_at: null,
    activation_sent_at: null,
    onboarding_complete: false,
    app_user: true,
  })

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message ?? 'Could not submit application.' }, { status: 500 })
  }

  if (licenseB64) {
    await db.from('verification_documents').insert({
      profile_id: userId,
      document_type: 'medical_license',
      document_url: `data:${licenseMime};base64,${licenseB64}`,
      status: 'pending_review',
    })
  }

  const emailResult = await trySendActivationEmail({
    origin: req.nextUrl.origin,
    userId,
    email,
    name: fullName,
    logContext: 'auth/signup/professional',
  })

  if (emailResult.sent) {
    await db
      .from('profiles')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('id', userId)
  }

  return NextResponse.json(
    activationResponse({ userId, emailSent: emailResult.sent }),
    { status: emailResult.sent ? 200 : 202 }
  )
}
