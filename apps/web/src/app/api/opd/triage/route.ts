import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordEncounterOpened } from '@synapse/db/clinical-journey'
import { persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, triageSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'triage', 'assign', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = triageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { patient_id, chief_complaint, clinical_stage, ...vitalsFields } = parsed.data

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
      clinical_stage: clinical_stage ?? null,
      status: 'open',
      visit_date: new Date().toISOString(),
      is_deleted: false,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 })

  const hasVitals = Object.values(vitalsFields).some((v) => v !== undefined)
  let vitalsRecorded = true
  if (hasVitals) {
    const { error: vitalsError } = await db.from('vitals').insert({
      tenant_id: ctx.tenantId,
      encounter_id: encounter.id,
      ...vitalsFields,
      recorded_by: ctx.userId,
      recorded_at: new Date().toISOString(),
      is_deleted: false,
    })
    if (vitalsError) {
      vitalsRecorded = false
    }
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'encounters',
    recordId: encounter.id,
    newValue: { patient_id, chief_complaint, clinical_stage },
  })

  let journeyWarnings: string[] = []
  try {
    const journey = recordEncounterOpened({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      encounterId: encounter.id as string,
      requesterId: ctx.userId,
      chiefComplaint: chief_complaint,
    })
    const persist = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [journey.triageTask],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })
    if (persist.errors.length) {
      journeyWarnings = persist.errors
      console.warn('[opd/triage] workqueue persist partial', persist)
    }
  } catch (error) {
    console.warn('[opd/triage] clinical journey step failed (encounter still saved)', error)
  }

  const { notifyClinicalQueue } = await import('@synapse/auth/mobile-push')
  notifyClinicalQueue({
    tenantId: ctx.tenantId,
    chiefComplaint: chief_complaint,
  })

  const response: {
    encounterId: string
    correlationId: string
    vitalsRecorded?: boolean
    journeyWarnings?: string[]
  } = {
    encounterId: encounter.id,
    correlationId: encounter.id as string,
  }
  if (hasVitals && !vitalsRecorded) {
    response.vitalsRecorded = false
  }
  if (journeyWarnings.length) {
    response.journeyWarnings = journeyWarnings
  }

  return NextResponse.json(response, { status: 201 })
}
