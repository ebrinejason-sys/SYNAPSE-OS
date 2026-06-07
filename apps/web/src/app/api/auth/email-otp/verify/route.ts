import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../../lib/supabase/server'
import { verifyOtpHash } from '../../../../../lib/otp'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const otp   = typeof body.otp   === 'string' ? body.otp.trim()                : ''

  if (!email || !otp || otp.length !== 6) {
    return NextResponse.json({ error: 'email and 6-digit otp required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const db  = svc as any

  const { data: row, error: fetchErr } = await db
    .from('auth_otps')
    .select('id, otp_hash, attempts')
    .eq('target', email)
    .eq('channel', 'email')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: 'No active verification found for this email. Request a new code.' },
      { status: 400 }
    )
  }

  if (row.attempts >= 5) {
    return NextResponse.json(
      { error: 'Too many incorrect attempts. Please request a new code.' },
      { status: 429 }
    )
  }

  await db.from('auth_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id)

  if (!verifyOtpHash(otp, row.otp_hash)) {
    const remaining = 4 - row.attempts
    return NextResponse.json(
      { error: `Incorrect code. ${remaining > 0 ? `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'No attempts remaining — request a new code.'}` },
      { status: 401 }
    )
  }

  await db.from('auth_otps').update({ used: true }).eq('id', row.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synapseos.tech'

  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/health/dashboard` },
  })

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('generateLink error:', linkErr?.message)
    return NextResponse.json({ error: 'Could not create session. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ token_hash: linkData.properties.hashed_token })
}
