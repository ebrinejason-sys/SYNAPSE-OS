import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  acceptReferral,
  cancelReferral,
  completeReferral,
  createFacilityReferral,
  facilityReferralFromRow,
  facilityReferralToRow,
  rejectReferral,
  type FacilityReferral,
} from '@synapse/db/referral-lifecycle'
import {
  advanceReferralLoop,
  recordReferralFeedback,
  referralLoopFromRow,
  referralLoopToRow,
  type ReferralLoopStage,
} from '@synapse/db/referral-loop'
import { publishClinicalTimelineBestEffort, referralLoopTimelineEvent } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  to_tenant_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  speciality: z.string().min(1).max(200),
  clinical_summary: z.string().min(1).max(8000),
  urgency: z.enum(['IMMEDIATE', 'URGENT', 'ROUTINE']).optional(),
  consent_obtained: z.boolean().optional(),
  consent_method: z.enum(['screen', 'sms_otp']).optional(),
})

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['accept', 'reject', 'complete', 'cancel', 'loop']),
  reason: z.string().max(2000).optional(),
  loop_stage: z.enum([
    'sent',
    'received',
    'accepted',
    'arrived',
    'seen',
    'feedback_returned',
    'completed',
    'rejected',
    'cancelled',
  ]).optional(),
  feedback: z.string().max(4000).optional(),
  counter_referral_id: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const direction = req.nextUrl.searchParams.get('direction') || 'outgoing'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const col = direction === 'incoming' ? 'to_tenant_id' : 'from_tenant_id'
  const { data, error } = await db
    .from('facility_referrals')
    .select('*')
    .eq(col, ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    referrals: (data ?? []).map((row: Record<string, unknown>) => ({
      ...facilityReferralFromRow(row),
      loop: referralLoopFromRow({ id: String(row.id), status: row.status as FacilityReferral['status'], ...row }),
    })),
  })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let referral: FacilityReferral
  try {
    referral = createFacilityReferral({
      fromTenantId: ctx.tenantId,
      toTenantId: parsed.data.to_tenant_id,
      patientId: parsed.data.patient_id,
      encounterId: parsed.data.encounter_id,
      speciality: parsed.data.speciality,
      clinicalSummary: parsed.data.clinical_summary,
      urgency: parsed.data.urgency,
      consentObtained: parsed.data.consent_obtained ?? false,
      consentMethod: parsed.data.consent_method,
      createdBy: ctx.userId,
      isSynthetic: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid referral'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter } = await db
    .from('encounters')
    .select('id, patient_id')
    .eq('id', referral.encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!encounter || encounter.patient_id !== referral.patientId) {
    return NextResponse.json({ error: 'Encounter not found for patient' }, { status: 404 })
  }

  const row = { ...facilityReferralToRow(referral), loop_stage: 'created' }
  const { error } = await db.from('facility_referrals').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'facility_referrals',
    recordId: referral.id,
    newValue: { status: referral.status, to_tenant_id: referral.toTenantId },
  })

  // Align encounter disposition when referring out
  await db
    .from('encounters')
    .update({
      disposition: 'REFERRAL',
      disposition_at: new Date().toISOString(),
      disposition_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', referral.encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_signed', false)

  return NextResponse.json({ referral }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: row, error: loadError } = await db
    .from('facility_referrals')
    .select('*')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Referral not found' }, { status: 404 })

  const current = facilityReferralFromRow(row)
  const isReceiver = current.toTenantId === ctx.tenantId
  const isSender = current.fromTenantId === ctx.tenantId
  if (!isReceiver && !isSender) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let next: FacilityReferral = current
  let loop = referralLoopFromRow({ id: current.id, status: current.status, ...row })
  try {
    if (parsed.data.action === 'loop') {
      const stage = parsed.data.loop_stage as ReferralLoopStage | undefined
      if (!stage) return NextResponse.json({ error: 'loop_stage required' }, { status: 400 })
      if (stage === 'feedback_returned') {
        loop = recordReferralFeedback(loop, {
          feedback: parsed.data.feedback || '',
          counterReferralId: parsed.data.counter_referral_id,
        })
      } else {
        loop = advanceReferralLoop(loop, stage)
      }
      if (loop.storedStatus === 'accepted' && current.status === 'pending') {
        if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can accept' }, { status: 403 })
        next = acceptReferral(current, { acceptedBy: ctx.userId })
      } else if (loop.storedStatus === 'rejected') {
        if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can reject' }, { status: 403 })
        next = rejectReferral(current, { reason: parsed.data.reason || parsed.data.feedback || 'Declined' })
      } else if (loop.storedStatus === 'completed') {
        if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can complete' }, { status: 403 })
        next = completeReferral(current)
      } else if (loop.storedStatus === 'cancelled') {
        next = cancelReferral(current)
      }
    } else if (parsed.data.action === 'accept') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can accept' }, { status: 403 })
      next = acceptReferral(current, { acceptedBy: ctx.userId })
      loop = { ...loop, stage: 'accepted', storedStatus: 'accepted' }
    } else if (parsed.data.action === 'reject') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can reject' }, { status: 403 })
      next = rejectReferral(current, { reason: parsed.data.reason || 'Declined' })
      loop = { ...loop, stage: 'rejected', storedStatus: 'rejected' }
    } else if (parsed.data.action === 'complete') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can complete' }, { status: 403 })
      next = completeReferral(current)
      loop = { ...loop, stage: 'completed', storedStatus: 'completed' }
    } else {
      next = cancelReferral(current)
      loop = { ...loop, stage: 'cancelled', storedStatus: 'cancelled' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid transition'
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const { error: updError } = await db
    .from('facility_referrals')
    .update({ ...facilityReferralToRow(next), ...referralLoopToRow(loop) })
    .eq('id', next.id)
  if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'facility_referrals',
    recordId: next.id,
    newValue: { status: next.status, action: parsed.data.action, loop_stage: loop.stage },
  })
  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    referralLoopTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: next.patientId,
      encounterId: next.encounterId,
      referralId: next.id,
      stage: loop.stage,
      createdBy: ctx.userId,
    }),
  )

  return NextResponse.json({ referral: next, loop })
}
