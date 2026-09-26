import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, validatePasswordStrength } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { trySendActivationEmail } from '../../../../../lib/auth/activation-email'
import { handleExistingAccountSignup, signupAccepted } from '../../../../../lib/auth/signup-response'
import { checkRateLimit, rateLimiters } from '../../../../../lib/rate-limit'

function roleForSpecialty(specialty: string): 'doctor' | 'nurse' | 'pharmacist' | 'lab_scientist' | 'radiologist' | 'clinical_officer' {
  const normalized = specialty.trim().toLowerCase()
  if (normalized === 'nursing') return 'nurse'
  if (normalized === 'pharmacy') return 'pharmacist'
  if (normalized === 'laboratory') return 'lab_scientist'
  if (normalized === 'radiology') return 'radiologist'
  if (normalized === 'other') return 'clinical_officer'
  return 'doctor'
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const rate = await checkRateLimit(rateLimiters.auth, `signup-professional:ip:${ip}`)
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 })
  }

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

  // Hash before the lookup so new and existing emails take comparable time.
  const passwordHash = await hashPassword(password)

  const db = supabaseAdmin as any
  const { data: existing, error: existingErr } = await db
    .from('profiles')
    .select('id, email, full_name, first_name, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .maybeSingle()

  if (existingErr) {
    console.error('[auth/signup/professional] existing lookup failed', existingErr)
    return NextResponse.json({ error: 'Could not submit application.' }, { status: 500 })
  }

  if (existing) {
    await handleExistingAccountSignup({
      db,
      existing,
      origin: req.nextUrl.origin,
      logContext: 'auth/signup/professional',
    })
    return signupAccepted()
  }

  const userId = randomUUID()
  const fullName = `${firstName} ${lastName}`.trim()
  const now = new Date().toISOString()

  const { error: profileErr } = await db.from('profiles').insert({
    id: userId,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email,
    phone: phone || null,
    gender: gender || null,
    role: roleForSpecialty(specialty),
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
    console.error('[auth/signup/professional] profile insert failed', profileErr)
    return NextResponse.json({ error: 'Could not submit application.' }, { status: 500 })
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

  return signupAccepted()
}
