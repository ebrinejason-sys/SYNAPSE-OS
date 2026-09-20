import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordEdTriagePlaced } from '@synapse/db/clinical-journey'
import { persistDomainEventsBestEffort, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { edTriageTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { appendClinicalChargeBestEffort, recordInvoiceCreatedEvent, resolveServicePrice } from '@synapse/db/clinical-charge'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, edTriageSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'triage', 'assign', 'emergency')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'emergency')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = edTriageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    patient_id,
    chief_complaint,
    clinical_stage,
    arrival_mode,
    ...vitalsFields
  } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encounterError } = await db
    .from('encounters')
    .insert({
      tenant_id: ctx.tenantId,
      hospital_id: ctx.hospitalId,
      patient_id,
      clinician_id: ctx.userId,
      chief_complaint,
      clinical_stage,
      status: 'open',
      visit_date: new Date().toISOString(),
      is_deleted: false,
      created_by: ctx.userId,
      metadata: {
        department: 'emergency',
        arrival_mode: arrival_mode ?? 'walk_in',
      },
    })
    .select('id')
    .single()

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 })

  const hasVitals = Object.values(vitalsFields).some((v) => v !== undefined)
  if (hasVitals) {
    await db.from('vitals').insert({
      tenant_id: ctx.tenantId,
      encounter_id: encounter.id,
      ...vitalsFields,
      recorded_by: ctx.userId,
      recorded_at: new Date().toISOString(),
      is_deleted: false,
    })
  }

  let journeyWarnings: string[] = []
  try {
    const journey = recordEdTriagePlaced({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      encounterId: encounter.id as string,
      requesterId: ctx.userId,
      chiefComplaint: chief_complaint,
      clinicalStage: clinical_stage,
      arrivalMode: arrival_mode,
    })
    const persist = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [journey.edTask],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })
    if (persist.errors.length) journeyWarnings = persist.errors

    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      edTriageTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: patient_id,
        encounterId: encounter.id as string,
        chiefComplaint: chief_complaint,
        clinicalStage: clinical_stage,
        arrivalMode: arrival_mode ?? 'walk_in',
        createdBy: ctx.userId,
      }),
    )

    const unitPrice = await resolveServicePrice(db, ctx.tenantId, 'consultation', 'Emergency')
    if (unitPrice != null) {
      const charge = await appendClinicalChargeBestEffort(db, {
        tenantId: ctx.tenantId,
        patientId: patient_id,
        encounterId: encounter.id as string,
        itemName: `ED triage · ${clinical_stage}`,
        unitPrice,
        sourceTable: 'encounters',
        sourceId: encounter.id as string,
      })
      if (!charge.ok) {
        journeyWarnings.push(charge.error)
      } else if (charge.result.created) {
        const outbox = recordInvoiceCreatedEvent({
          tenantId: ctx.tenantId,
          hospitalId: ctx.hospitalId,
          patientId: patient_id,
          encounterId: encounter.id as string,
          invoiceId: charge.result.invoiceId,
          totalAmount: charge.result.totalAmount,
          actorId: ctx.userId,
        })
        await persistDomainEventsBestEffort(db, outbox.list({ correlationId: encounter.id as string }))
      }
    }
  } catch (error) {
    console.warn('[emergency/triage] journey step failed (encounter still saved)', error)
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'encounters',
    recordId: encounter.id,
    newValue: { patient_id, chief_complaint, clinical_stage, department: 'emergency' },
  })

  return NextResponse.json(
    {
      encounterId: encounter.id,
      correlationId: encounter.id,
      journeyWarnings: journeyWarnings.length ? journeyWarnings : undefined,
    },
    { status: 201 },
  )
}
