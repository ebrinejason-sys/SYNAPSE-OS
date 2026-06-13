import { NextRequest, NextResponse } from 'next/server'
import { createAndSendOTP } from '@synapse/auth'
import { sendOTP } from '@synapse/email'
import { supabaseAdmin } from '@synapse/db/admin'

export async function POST(req: NextRequest) {
  const body  = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('email', email)
    .single()

  if (!profile) {
    // Don't reveal whether the account exists
    return NextResponse.json({ ok: true })
  }

  try {
    const otp = await createAndSendOTP({ channel: 'email', target: email })
    await sendOTP({
      to:      email,
      name:    (profile.full_name as string | null) ?? email,
      otp,
      purpose: 'login',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'TOO_MANY_REQUESTS') {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting a new code.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
