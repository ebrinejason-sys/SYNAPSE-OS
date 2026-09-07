import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated, verifyOTP, signToken, createSession } from '@synapse/auth'
import { signMfaPendingToken, mfaCookieOptions, MFA_PENDING_COOKIE } from '@synapse/auth/mfa'
import { getPostLoginPath } from '@synapse/auth/redirects'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const otp   = typeof body.otp   === 'string' ? body.otp.trim()                : ''

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trustedTenantId = req.headers.get('x-tenant-id')?.trim() || null
  let profileQuery = (supabaseAdmin as any)
    .from('profiles')
    .select('id, role, tenant_id, synapse_id, verification_status, email_verified_at, is_deleted, must_change_password, onboarding_complete')
    .eq('email', email)
  if (trustedTenantId) profileQuery = profileQuery.eq('tenant_id', trustedTenantId)
  const { data: profiles, error: profileErr } = await profileQuery.limit(2)
  const profile = profiles?.length === 1 ? profiles[0] : null

  if (profileErr || !profile) {
    if (!trustedTenantId && (profiles?.length ?? 0) > 1) {
      return NextResponse.json(
        { error: 'This email belongs to more than one facility. Sign in from your facility address.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  if (!isAccountActivated(profile)) {
    return NextResponse.json({ error: ACCOUNT_ACTIVATION_ERROR }, { status: 403 })
  }

  // platform_admin requires TOTP as third factor
  if (profile.role === 'platform_admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrollment } = await (supabaseAdmin as any)
      .from('mfa_enrollments')
      .select('id, verified')
      .eq('user_id', profile.id)
      .eq('verified', true)
      .maybeSingle()

    const preAuthToken = await signMfaPendingToken({
      sub: profile.id as string,
      email,
    })

    // Set cookie directly on response — cookies().set() does not propagate in Next.js 15 Route Handlers
    const mfaResponse = NextResponse.json(enrollment ? { mfaRequired: true } : { mfaSetupRequired: true })
    mfaResponse.cookies.set(MFA_PENDING_COOKIE, preAuthToken, mfaCookieOptions)
    return mfaResponse
  }

  // Non-platform_admin: issue full session immediately
  const token = await signToken({
    sub:        profile.id,
    email,
    role:       profile.role,
    tenant_id:  profile.tenant_id,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('profiles')
    .update({ login_attempts: 0 })
    .eq('id', profile.id)

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  // Set cookie directly on response — cookies().set() does not propagate in Next.js 15 Route Handlers
  let pharmacyOnboardingStep: number | null = null
  let tenantFacilityType: string | null = null

  if (profile.tenant_id) {
    const [{ data: tenant }, { data: pharmOnboarding }] = await Promise.all([
      (supabaseAdmin as any)
        .from('tenants')
        .select('facility_type, onboarding_completed')
        .eq('id', profile.tenant_id)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from('pharmacy_onboarding')
        .select('current_step')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle(),
    ])
    tenantFacilityType = tenant?.facility_type ?? null
    pharmacyOnboardingStep = pharmOnboarding?.current_step ?? null
  }

  const redirectTo = getPostLoginPath({
    role: profile.role,
    mustChangePassword: Boolean(profile.must_change_password),
    emailVerified: Boolean(profile.email_verified_at),
    onboardingComplete: Boolean(profile.onboarding_complete),
    pharmacyOnboardingStep,
    tenantFacilityType,
    pharmacyAppUrl: process.env.NEXT_PUBLIC_PHARMACY_APP_URL,
  })

  const response = NextResponse.json({ ok: true, redirectTo })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })
  return response
}
