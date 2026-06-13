import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNT_ACTIVATION_ERROR, isAccountActivated } from '@synapse/auth'
import { createServiceClient } from '../../../../../lib/supabase/server'
import { generateOtp, hashOtp } from '../../../../../lib/otp'

const RATE_LIMIT = 3
const OTP_TTL_MIN = 10

async function sendSms(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from  = process.env.TWILIO_PHONE_NUMBER!

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SMS failed: ${err}`)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''

  if (!phone || !/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Phone must be in E.164 format, e.g. +256712345678' },
      { status: 400 }
    )
  }

  const db = createServiceClient() as any

  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id, verification_status, email_verified_at, is_deleted')
    .eq('phone', phone)
    .maybeSingle()

  if (profileErr) {
    console.error('[auth/phone/send] profile lookup error:', profileErr.message)
    return NextResponse.json({ error: 'Could not check account status.' }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json(
      { error: 'No Synapse OS account is linked to this phone number.' },
      { status: 404 }
    )
  }

  if (!isAccountActivated(profile)) {
    return NextResponse.json(
      { error: ACCOUNT_ACTIVATION_ERROR },
      { status: 403 }
    )
  }

  const { count } = await db
    .from('auth_otps')
    .select('*', { count: 'exact', head: true })
    .eq('target', phone)
    .eq('channel', 'phone')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before requesting another code.' },
      { status: 429 }
    )
  }

  const otp     = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString()

  const { data: otpRow, error: insertErr } = await db
    .from('auth_otps')
    .insert({ channel: 'phone', target: phone, otp_hash: otpHash, expires_at: expiresAt })
    .select('id')
    .single()

  if (insertErr) {
    console.error('auth_otps insert error:', insertErr.message)
    return NextResponse.json({ error: 'Failed to create verification' }, { status: 500 })
  }

  try {
    await sendSms(
      phone,
      `Your Synapse OS code is ${otp}. Valid for ${OTP_TTL_MIN} minutes. Do not share this code.`
    )
  } catch (err) {
    if (otpRow?.id) {
      await db.from('auth_otps').delete().eq('id', otpRow.id as string)
    }
    console.error('SMS send error:', err)
    return NextResponse.json({ error: 'Failed to send SMS. Check the number and try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
