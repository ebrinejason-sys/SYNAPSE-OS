import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { trySendActivationEmail } from '../../../../../lib/auth/activation-email'
import { checkRateLimit, rateLimiters } from '../../../../../lib/rate-limit'

const BLOCKED_STATUSES = new Set(['deleted', 'disabled', 'suspended', 'reset'])

/**
 * Public, anti-enumeration endpoint: every accepted request gets the same
 * `{ ok: true }` response whether the email is unknown, archived, suspended,
 * already verified, or pending activation. Only genuinely pending accounts are
 * emailed. Delivery failures are logged server-side, not disclosed.
 */
const GENERIC_OK = { ok: true } as const

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const ipRate = await checkRateLimit(rateLimiters.auth, `activation-resend:ip:${ip}`)
  if (!ipRate.success) {
    return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  const emailRate = await checkRateLimit(rateLimiters.auth, `activation-resend:email:${email}`)
  if (!emailRate.success) {
    return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 })
  }

  const db = supabaseAdmin as any
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, email, full_name, first_name, verification_status, email_verified_at, is_deleted')
    .eq('email', email)
    .maybeSingle()

  if (profileErr) {
    console.error('[auth/activation/resend] profile lookup failed', profileErr)
    return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
  }

  if (!profile) return NextResponse.json(GENERIC_OK)

  const status = String(profile.verification_status ?? '').toLowerCase()
  if (profile.is_deleted || BLOCKED_STATUSES.has(status) || profile.email_verified_at) {
    return NextResponse.json(GENERIC_OK)
  }

  const emailResult = await trySendActivationEmail({
    origin: req.nextUrl.origin,
    userId: profile.id as string,
    email: profile.email as string,
    name: (profile.full_name as string | null) ?? (profile.first_name as string | null) ?? 'there',
    logContext: 'auth/activation/resend',
  })

  if (emailResult.sent) {
    await db
      .from('profiles')
      .update({ activation_sent_at: new Date().toISOString() })
      .eq('id', profile.id as string)
  }

  return NextResponse.json(GENERIC_OK)
}
