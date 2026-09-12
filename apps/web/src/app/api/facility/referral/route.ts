import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  acceptReferral,
  cancelReferral,
  completeReferral,
  createFacilityReferral,
  rejectReferral,
  type FacilityReferral,
} from '@synapse/db/referral-lifecycle'
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
  action: z.enum(['accept', 'reject', 'complete', 'cancel']),
  reason: z.string().max(2000).optional(),
})

function rowToReferral(row: Record<string, unknown>): FacilityReferral {
  return {
    id: String(row.id),
    fromTenantId: String(row.from_tenant_id),
    toTenantId: String(row.to_tenant_id),
    patientId: String(row.patient_id),
    encounterId: String(row.encounter_id),
    status: row.status as FacilityReferral['status'],
    speciality: String(row.speciality ?? ''),
    urgency: (row.urgency as FacilityReferral['urgency']) ?? 'ROUTINE',
    clinicalSummary: String(row.clinical_summary ?? ''),
    consentObtained: Boolean(row.consent_obtained),
    consentMethod: (row.consent_method as FacilityReferral['consentMethod']) ?? null,
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
    acceptedBy: row.accepted_by ? String(row.accepted_by) : null,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    rejectedReason: row.rejected_reason ? String(row.rejected_reason) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    isSynthetic: Boolean(row.is_synthetic),
  }
}

function referralToRow(ref: FacilityReferral) {
  return {
    id: ref.id,
    from_tenant_id: ref.fromTenantId,
    to_tenant_id: ref.toTenantId,
    patient_id: ref.patientId,
    encounter_id: ref.encounterId,
    status: ref.status,
    speciality: ref.speciality,
    urgency: ref.urgency,
    clinical_summary: ref.clinicalSummary,
    consent_obtained: ref.consentObtained,
    consent_method: ref.consentMethod,
    created_by: ref.createdBy,
    created_at: ref.createdAt,
    accepted_by: ref.acceptedBy ?? null,
    accepted_at: ref.acceptedAt ?? null,
    rejected_reason: ref.rejectedReason ?? null,
    completed_at: ref.completedAt ?? null,
    cancelled_at: ref.cancelledAt ?? null,
    updated_at: new Date().toISOString(),
  }
}

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
  return NextResponse.json({ referrals: (data ?? []).map(rowToReferral) })
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

  const row = referralToRow(referral)
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

  const current = rowToReferral(row)
  const isReceiver = current.toTenantId === ctx.tenantId
  const isSender = current.fromTenantId === ctx.tenantId
  if (!isReceiver && !isSender) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let next: FacilityReferral
  try {
    if (parsed.data.action === 'accept') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can accept' }, { status: 403 })
      next = acceptReferral(current, { acceptedBy: ctx.userId })
    } else if (parsed.data.action === 'reject') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can reject' }, { status: 403 })
      next = rejectReferral(current, { reason: parsed.data.reason || 'Declined' })
    } else if (parsed.data.action === 'complete') {
      if (!isReceiver) return NextResponse.json({ error: 'Only receiving facility can complete' }, { status: 403 })
      next = completeReferral(current)
    } else {
      if (!isSender && !isReceiver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      next = cancelReferral(current)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid transition'
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const { error: updError } = await db
    .from('facility_referrals')
    .update(referralToRow(next))
    .eq('id', next.id)
  if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'facility_referrals',
    recordId: next.id,
    newValue: { status: next.status, action: parsed.data.action },
  })

  return NextResponse.json({ referral: next })
}
