import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { resend, NOTIFY_EMAILS, FROM_EMAIL, FROM_NAME, brandedEmail } from '../../../../lib/resend'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    fullName, email, phone, role, specialty, licenseNumber,
    hospitalName, location, hospitalType, bedCount, currentSystem,
    interests, message, hearAboutUs,
  } = body

  if (!fullName || !email || !role) {
    return NextResponse.json({ error: 'fullName, email, and role are required' }, { status: 400 })
  }

  const supabase = await createClient()
  await (supabase as any).from('professional_leads').upsert(
    {
      full_name: fullName,
      email,
      phone: phone ?? null,
      role,
      specialty: specialty ?? null,
      license_number: licenseNumber ?? null,
      hospital_name: hospitalName ?? null,
      location: location ?? null,
      hospital_type: hospitalType ?? null,
      bed_count: bedCount ? Number(bedCount) : null,
      current_system: currentSystem ?? null,
      interests: interests ?? [],
      message: message ?? null,
      hear_about_us: hearAboutUs ?? null,
      status: 'new',
      source: 'apply_professional',
    },
    { onConflict: 'email' }
  )

  const interestList = Array.isArray(interests) && interests.length
    ? `<ul style="margin:8px 0;padding-left:20px;color:#A0A0B0;">${interests.map((i: string) => `<li style="margin:2px 0;">${i}</li>`).join('')}</ul>`
    : '<p style="color:#60607A;margin:4px 0;">None specified</p>'

  /* Notify founders */
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: NOTIFY_EMAILS,
    subject: `New Professional Application: ${fullName} (${role})`,
    html: brandedEmail({
      subject: `New Professional Application: ${fullName}`,
      body: `
        <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#F5F5F7;">New Healthcare Professional Application</h2>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          ${[
            ['Name', fullName],
            ['Email', email],
            ['Phone', phone || '—'],
            ['Role', role],
            ['Specialty', specialty || '—'],
            ['License', licenseNumber || '—'],
            ['Hospital', hospitalName || '—'],
            ['Location', location || '—'],
            ['Facility Type', hospitalType || '—'],
            ['Beds', bedCount || '—'],
            ['Current System', currentSystem || '—'],
            ['Heard via', hearAboutUs || '—'],
          ].map(([k, v]) => `
            <tr>
              <td style="padding:7px 0;font-size:13px;font-weight:600;color:#A0A0B0;width:140px;">${k}</td>
              <td style="padding:7px 0;font-size:13px;color:#F5F5F7;">${v}</td>
            </tr>`).join('')}
        </table>
        <div style="margin-top:16px;">
          <p style="font-size:13px;font-weight:600;color:#A0A0B0;margin-bottom:4px;">Modules of interest:</p>
          ${interestList}
        </div>
        ${message ? `<div style="margin-top:16px;padding:16px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid #F97316;"><p style="font-size:13px;color:#A0A0B0;margin:0;">${message}</p></div>` : ''}
      `,
    }),
  })

  /* Auto-reply */
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: 'Your Synapse OS application has been received',
    html: brandedEmail({
      subject: 'Your Synapse OS application has been received',
      body: `
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">Thank you, ${fullName.split(' ')[0]}.</h2>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 16px;">
          We've received your application to join Synapse OS as a <strong style="color:#F5F5F7;">${role}</strong>
          ${hospitalName ? ` at <strong style="color:#F5F5F7;">${hospitalName}</strong>` : ''}.
          Our team reviews every application personally and will be in touch within 24 hours.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 24px;">
          In the meantime, try the live AI clinical demo to see what Synapse OS can do.
        </p>
        <a href="https://demo.synapseos.tech" style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:12px;">Try Live Demo</a>
        <a href="https://synapseos.tech" style="display:inline-block;background:rgba(255,255,255,0.08);color:#F5F5F7;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);">Back to Synapse OS</a>
      `,
    }),
  })

  return NextResponse.json({ ok: true })
}
