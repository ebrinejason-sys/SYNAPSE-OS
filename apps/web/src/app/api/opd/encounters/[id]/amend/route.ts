import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordEncounterAmended } from '@synapse/db/clinical-journey'
import { encounterAmendedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../../lib/hospital-shared'
import { requireHospitalStaffContext, encounterAmendSchema } from '../../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'amend', 'opd')
  if (cap) return cap

  const { id: encounterId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('encounter_amendments')
    .select('id, field_name, previous_value, new_value, reason, amended_by, amended_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .order('amended_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ amendments: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'amend', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  const body = await req.json().catch(() => null)
  const parsed = encounterAmendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { field, new_value, reason } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: loadError } = await db
    .from('encounters')
    .select('id, patient_id, is_signed, chief_complaint, clinical_stage, metadata')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (!encounter.is_signed) {
    return NextResponse.json({ error: 'Encounter must be signed before amendment' }, { status: 409 })
  }

  let previousValue = ''
  if (field === 'chief_complaint') previousValue = encounter.chief_complaint ?? ''
  else if (field === 'clinical_stage') previousValue = encounter.clinical_stage ?? ''
  else previousValue = (encounter.metadata as { clinical_note?: string } | null)?.clinical_note ?? ''

  const { data: amendmentId, error: amendError } = await db.rpc('apply_encounter_amendment', {
    p_tenant_id: ctx.tenantId,
    p_encounter_id: encounterId,
    p_field: field,
    p_new_value: new_value,
    p_reason: reason,
    p_amended_by: ctx.userId,
  })

  if (amendError) {
    const message = amendError.message ?? 'Amendment failed'
    const status = message.includes('NOT_SIGNED') || message.includes('NO_CHANGE') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }

  try {
    const journey = recordEncounterAmended({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: encounter.patient_id,
      encounterId,
      amendmentId: String(amendmentId),
      fieldName: field,
      previousValue,
      newValue: new_value,
      reason,
      amendedBy: ctx.userId,
    })
    await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      encounterAmendedTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: encounter.patient_id,
        encounterId,
        amendmentId: String(amendmentId),
        fieldName: field,
        reason,
        amendedBy: ctx.userId,
      }),
    )
  } catch (error) {
    console.warn('[opd/encounters/amend] event persist failed', error)
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'encounter_amendments',
    recordId: String(amendmentId),
    newValue: { encounter_id: encounterId, field, new_value, reason },
  })

  return NextResponse.json({
    amendmentId: String(amendmentId),
    encounterId,
    field,
    previousValue,
    newValue: new_value,
  })
}
