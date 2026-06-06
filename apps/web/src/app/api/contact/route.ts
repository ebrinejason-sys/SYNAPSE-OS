import { NextRequest, NextResponse } from 'next/server'
import { resend, NOTIFY_EMAILS, FROM_EMAIL, FROM_NAME, brandedEmail } from '../../../lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, email, subject, message, intent } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 })
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: NOTIFY_EMAILS,
    replyTo: email,
    subject: `Contact: ${subject || 'General enquiry'} — ${name}`,
    html: brandedEmail({
      subject: `Contact: ${subject || 'General enquiry'} — ${name}`,
      body: `
        <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#F5F5F7;">New Contact Message</h2>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          ${[
            ['From', name],
            ['Email', email],
            ['Subject', subject || '—'],
            ['Intent', intent || 'General'],
          ].map(([k, v]) => `
            <tr>
              <td style="padding:8px 0;font-size:13px;font-weight:600;color:#A0A0B0;width:100px;">${k}</td>
              <td style="padding:8px 0;font-size:13px;color:#F5F5F7;">${v}</td>
            </tr>`).join('')}
        </table>
        <div style="margin-top:20px;padding:20px;background:rgba(255,255,255,0.04);border-radius:12px;border-left:3px solid #F97316;">
          <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0;white-space:pre-wrap;">${message}</p>
        </div>
        <div style="margin-top:20px;">
          <a href="mailto:${email}" style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;">Reply to ${name}</a>
        </div>
      `,
    }),
  })

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: 'We received your message — Synapse OS',
    html: brandedEmail({
      subject: 'We received your message — Synapse OS',
      body: `
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">Thanks, ${name}.</h2>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 16px;">
          We received your message and will reply within 24 hours.
        </p>
        <a href="https://synapseos.tech" style="display:inline-block;background:rgba(255,255,255,0.08);color:#F5F5F7;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);">Back to Synapse OS</a>
      `,
    }),
  })

  return NextResponse.json({ ok: true })
}
