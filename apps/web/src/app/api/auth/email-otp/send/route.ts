import { NextRequest, NextResponse } from 'next/server'
import { isAccountActivated, createAndSendOTP, shouldSkipOtpEmailDelivery, withMembershipSuspension } from '@synapse/auth'
import { createServiceClient } from '../../../../../lib/supabase/server'
import { sendOtpEmail } from '../../../../../lib/resend'
import { checkRateLimit, rateLimiters } from '../../../../../lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const rate = await checkRateLimit(rateLimiters.auth, `email-otp-send:${ip}`)
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many attempts. Please wait before requesting another code.' }, { status: 429 })
  }

  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const db = createServiceClient() as any

  // Pre-proof endpoint: every outcome below the input check answers { ok: true }, so the
  // response never distinguishes unknown, duplicated, rate-limited or undeliverable accounts.
  const { data: profiles, error: profileErr } = await db
    .from('profiles')
    .select('id, tenant_id, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .limit(2)

  if (profileErr) {
    console.error('email otp profile lookup error:', profileErr.message)
    return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
  }

  const profile = profiles?.length === 1 ? profiles[0] : null
  if (!profile) {
    return NextResponse.json({ ok: true })
  }

  // Pre-proof endpoint: answer non-active accounts exactly like unknown emails
  // (no code is sent). State-specific messages are only returned after a
  // credential is proven (password-login / email-otp verify).
  if (!isAccountActivated(await withMembershipSuspension(profile))) {
    return NextResponse.json({ ok: true })
  }

  const { data: tenantRow } = await db
    .from('tenants')
    .select('is_synthetic, slug')
    .eq('id', profile.tenant_id as string)
    .maybeSingle()

  const e2e = {
    email,
    isSyntheticTenant: Boolean(tenantRow?.is_synthetic),
    facilitySlug: typeof tenantRow?.slug === 'string' ? tenantRow.slug : null,
  }

  let otp: string
  try {
    otp = await createAndSendOTP({ channel: 'email', target: email, e2e })
  } catch (error) {
    console.error('Email OTP create error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: true })
  }

  if (!shouldSkipOtpEmailDelivery(e2e)) {
    try {
      await sendOtpEmail(email, otp)
    } catch (err) {
      console.error('Email OTP send error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
