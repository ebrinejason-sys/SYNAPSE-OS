import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { sendWaitlistEmail, resend, NOTIFY_EMAILS, FROM_EMAIL, FROM_NAME, brandedEmail } from '../../../../lib/resend'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const clean = email.toLowerCase().trim()
  const supabase = await createClient()

  const { error } = await (supabase as any).from('apk_waitlist').upsert(
    { email: clean, source: 'download_page' },
    { onConflict: 'email' }
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  // Confirmation to the user
  await sendWaitlistEmail(clean).catch(err => console.error('waitlist email error:', err))

  // Notify founders
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: NOTIFY_EMAILS,
    subject: `New APK waitlist signup: ${clean}`,
    html: brandedEmail({
      subject: `New APK waitlist signup`,
      body: `<p style="font-size:15px;color:#A0A0B0;margin:0;">
        <strong style="color:#F5F5F7;">${clean}</strong> joined the Synapse OS mobile app waitlist.
      </p>`,
    }),
  }).catch(err => console.error('founder notification error:', err))

  return NextResponse.json({ ok: true })
}
