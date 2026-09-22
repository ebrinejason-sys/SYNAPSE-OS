import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import {
  buildMeetingLeadRow,
  buildMeetingRow,
  validateMeetingRequest,
} from '@synapse/db/commercial-crm'
import { escapeHtml } from '@synapse/db/html-escape'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { resend, FROM_EMAIL, FROM_NAME, brandedEmail } from '@/lib/resend'

export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rate = await checkRateLimit(rateLimiters.meeting, `meeting:${ip}`)
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many meeting requests. Please try again later.' },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => null)
  const validated = validateMeetingRequest(body)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const value = validated.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const leadPayload = buildMeetingLeadRow(value)
  // Upsert-ish: try insert; if unique email conflict, update and continue
  let leadId: string | null = null
  const { data: insertedLead, error: leadInsertError } = await db
    .from('hospital_leads')
    .insert(leadPayload)
    .select('id')
    .maybeSingle()

  if (leadInsertError) {
    const { data: existing } = await db
      .from('hospital_leads')
      .select('id')
      .eq('contact_email', value.workEmail)
      .maybeSingle()
    if (existing?.id) {
      leadId = existing.id
      const { error: updateError } = await db
        .from('hospital_leads')
        .update({
          ...leadPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (updateError) {
        console.error('[book-meeting] lead update failed', updateError.message)
        return NextResponse.json(
          { error: 'Could not update lead record. Please email us directly.' },
          { status: 500 },
        )
      }
    } else {
      console.error('[book-meeting] lead insert failed', leadInsertError.message)
      return NextResponse.json(
        { error: 'Could not save meeting request. Please email us directly.' },
        { status: 500 },
      )
    }
  } else {
    leadId = insertedLead?.id ?? null
  }

  const meetingPayload = buildMeetingRow(value, leadId)
  const { data: meeting, error: meetingError } = await db
    .from('commercial_meetings')
    .insert(meetingPayload)
    .select('id')
    .maybeSingle()

  if (meetingError) {
    console.error('[book-meeting] meeting insert failed', meetingError.message)
    return NextResponse.json(
      {
        error: 'Meeting request could not be stored. Please email us directly.',
        contact: PUBLIC_CONTACT_EMAIL,
      },
      { status: 500 },
    )
  }

  if (leadId) {
    const { error: activityError } = await db.from('commercial_lead_activities').insert({
      lead_id: leadId,
      meeting_id: meeting?.id ?? null,
      activity_type: 'meeting_requested',
      summary: 'Book a Meeting request submitted',
      body: value.message,
      to_stage: 'LEAD',
      metadata: { source: value.source, ip },
    })
    if (activityError) {
      console.error('[book-meeting] activity insert failed', activityError.message)
    }
  }

  let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped'
  let emailDetail: string | null = null

  if (!process.env.RESEND_API_KEY) {
    emailStatus = 'skipped'
    emailDetail = 'RESEND_API_KEY not configured — request persisted for Platform Admin'
  } else {
    try {
      const notifyTo = [
        PUBLIC_CONTACT_EMAIL,
        ...(process.env.COMMERCIAL_NOTIFY_EMAILS ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      ]
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: notifyTo,
        replyTo: value.workEmail,
        subject: `Meeting request — ${value.organization || value.facilityName || value.name}`,
        html: brandedEmail({
          subject: `Meeting request — ${escapeHtml(value.name)}`,
          body: `
            <h2 style="margin:0 0 16px;font-size:20px;color:#F5F5F7;">New Book a Meeting request</h2>
            <p style="color:#A0A0B0;font-size:14px;">
              ${escapeHtml(value.name)} · ${escapeHtml(value.workEmail)}<br/>
              ${escapeHtml(value.organization) || '—'} / ${escapeHtml(value.facilityName) || '—'} · ${escapeHtml(value.facilityType) || '—'}<br/>
              Preferred: ${escapeHtml(value.preferredMeetingAt) || 'not specified'}
            </p>
            <p style="color:#A0A0B0;font-size:14px;white-space:pre-wrap;">${escapeHtml(value.message)}</p>
            <p style="color:#A0A0B0;font-size:12px;">Lead ${escapeHtml(leadId)} · Meeting ${escapeHtml(meeting?.id)}</p>
          `,
        }),
      })
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [value.workEmail],
        subject: 'We received your meeting request — SYNAPSE',
        html: brandedEmail({
          subject: 'Meeting request received',
          body: `
            <h2 style="margin:0 0 12px;font-size:20px;color:#F5F5F7;">Thanks, ${escapeHtml(value.name)}.</h2>
            <p style="color:#A0A0B0;font-size:15px;line-height:1.7;">
              We received your request to meet with the SYNAPSE team. A colleague will follow up
              shortly. You can also reach us at ${escapeHtml(PUBLIC_CONTACT_EMAIL)}.
            </p>
          `,
        }),
      })
      emailStatus = 'sent'
    } catch (err) {
      emailStatus = 'failed'
      emailDetail = err instanceof Error ? err.message : String(err)
      console.error('[book-meeting] email failed', emailDetail)
    }
  }

  return NextResponse.json({
    ok: true,
    meetingId: meeting?.id ?? null,
    leadId,
    emailStatus,
    emailDetail,
    contact: PUBLIC_CONTACT_EMAIL,
  })
}
