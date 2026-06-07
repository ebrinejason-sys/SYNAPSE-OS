import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../lib/supabase/server'
import { resend, NOTIFY_EMAILS, FROM_EMAIL, FROM_NAME, brandedEmail } from '../../../lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const db = createServiceClient() as any
  const { error } = await db
    .from('newsletter_subscribers')
    .upsert(
      { email, source: 'landing_page', subscribed: true, subscribed_at: new Date().toISOString() },
      { onConflict: 'email' }
    )

  if (error) {
    console.error('newsletter upsert error:', error.message)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synapseos.tech'
  const unsubToken = Buffer.from(email).toString('base64url')
  const unsubscribeUrl = `${appUrl}/api/newsletter/unsubscribe?t=${unsubToken}`

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: "You're subscribed to Synapse OS updates",
    html: brandedEmail({
      subject: "You're subscribed to Synapse OS updates",
      unsubscribeUrl,
      body: `
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">You're on the list.</h2>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 16px;">
          We'll send you updates on new features, pilot stories, public health reports, and release announcements.
          No spam &mdash; we respect your inbox.
        </p>
        <a href="https://synapseos.tech" style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;">Visit Synapse OS</a>
      `,
    }),
  }).catch(err => console.error('newsletter confirmation email error:', err))

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: NOTIFY_EMAILS,
    subject: `New newsletter subscriber: ${email}`,
    html: brandedEmail({
      subject: `New newsletter subscriber: ${email}`,
      body: `
        <p style="font-size:15px;color:#A0A0B0;margin:0;">
          <strong style="color:#F5F5F7;">${email}</strong> just subscribed to the Synapse OS newsletter via the landing page.
        </p>
      `,
    }),
  }).catch(err => console.error('newsletter founder notification error:', err))

  return NextResponse.json({ ok: true })
}
