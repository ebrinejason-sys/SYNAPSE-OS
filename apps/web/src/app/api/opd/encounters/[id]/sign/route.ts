import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordEncounterSigned } from '@synapse/db/clinical-journey'
import { persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { encounterSignedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: loadError } = await db
    .from('encounters')
    .select('id, tenant_id, hospital_id, patient_id, is_signed, chief_complaint')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.is_signed) {
    return NextResponse.json({ error: 'Encounter already signed' }, { status: 409 })
  }

  const signedAt = new Date().toISOString()
  const { error: updateError } = await db
    .from('encounters')
    .update({
      is_signed: true,
      signed_at: signedAt,
      signed_by: ctx.userId,
      status: 'signed',
      updated_at: signedAt,
    })
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_signed', false)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  try {
    const journey = recordEncounterSigned({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: encounter.patient_id,
      encounterId,
      signerId: ctx.userId,
    })
    await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [],
      events: journey.queue.outbox.list({ correlationId: encounterId }),
    })
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      encounterSignedTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: encounter.patient_id,
        encounterId,
        signedBy: ctx.userId,
      }),
    )
  } catch (error) {
    console.warn('[opd/encounters/sign] event persist failed', error)
  }

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'encounters',
    recordId: encounterId,
    newValue: { is_signed: true, signed_at: signedAt },
  })

  return NextResponse.json({ encounterId, signedAt, status: 'signed' })
}
