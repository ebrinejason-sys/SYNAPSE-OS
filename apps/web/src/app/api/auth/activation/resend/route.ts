import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { activationResponse, trySendActivationEmail } from '../../../../../lib/auth/activation-email'

const BLOCKED_STATUSES = new Set(['deleted', 'disabled', 'suspended'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
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

  if (!profile) {
    return NextResponse.json({ ok: true })
  }

  const status = String(profile.verification_status ?? '').toLowerCase()
  if (profile.is_deleted || BLOCKED_STATUSES.has(status)) {
    return NextResponse.json({ ok: true })
  }

  if (profile.email_verified_at) {
    return NextResponse.json({ ok: true, activationRequired: false })
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

  return NextResponse.json(
    activationResponse({ userId: profile.id as string, emailSent: emailResult.sent }),
    { status: emailResult.sent ? 200 : 202 }
  )
}
