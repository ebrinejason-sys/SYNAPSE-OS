import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordAdmissionPlaced } from '@synapse/db/clinical-journey'
import { persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { admissionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, admissionCreateSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'admission', 'read', 'ipd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'ipd')
  if (moduleBlock) return moduleBlock

  const availableOnly = req.nextUrl.searchParams.get('available') === 'true'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let bedQuery = db
    .from('hospital_beds')
    .select('id, ward, room, bed_number, status, current_patient_id, bed_type')
    .eq('hospital_id', ctx.hospitalId)
    .eq('is_deleted', false)
    .order('ward')
    .limit(200)

  if (ctx.tenantId) bedQuery = bedQuery.eq('tenant_id', ctx.tenantId)
  if (availableOnly) bedQuery = bedQuery.is('current_patient_id', null).eq('status', 'available')

  const { data: beds, error: bedError } = await bedQuery
  if (bedError) return NextResponse.json({ error: bedError.message }, { status: 500 })

  const { data: tasks } = await db
    .from('department_tasks')
    .select('id, patient_id, encounter_id, title, status, source_id, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('task_type', 'admission')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ beds: beds ?? [], admissions: tasks ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'admission', 'create', 'ipd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'ipd')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = admissionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { patient_id, bed_id, reason, encounter_id } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: bed, error: bedError } = await db
    .from('hospital_beds')
    .select('id, ward, status, current_patient_id, hospital_id, tenant_id')
    .eq('id', bed_id)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()

  if (bedError) return NextResponse.json({ error: bedError.message }, { status: 500 })
  if (!bed) return NextResponse.json({ error: 'Bed not found' }, { status: 404 })
  if (bed.current_patient_id) {
    return NextResponse.json({ error: 'Bed is already occupied' }, { status: 409 })
  }

  let journeyWarnings: string[] = []
  let admissionId = crypto.randomUUID()
  let admissionTaskId: string | undefined
  let correlationId = encounter_id ?? admissionId

  try {
    const journey = recordAdmissionPlaced({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      bedId: bed_id,
      requesterId: ctx.userId,
      reason,
      encounterId: encounter_id ?? null,
      ward: bed.ward ?? null,
      admissionId,
      correlationId: encounter_id ?? admissionId,
    })

    admissionId = journey.admissionId
    admissionTaskId = journey.admissionTask.id
    correlationId = journey.correlationId

    const { error: bedUpdateError } = await db
      .from('hospital_beds')
      .update({
        current_patient_id: patient_id,
        status: 'occupied',
        last_status_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bed_id)
      .is('current_patient_id', null)

    if (bedUpdateError) journeyWarnings.push(bedUpdateError.message)

    const persistQueue = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [journey.admissionTask],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })
    if (persistQueue.errors.length) journeyWarnings.push(...persistQueue.errors)
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      admissionTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: patient_id,
        admissionId,
        bedId: bed_id,
        ward: bed.ward ?? null,
        reason,
        createdBy: ctx.userId,
      }),
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admission journey failed' },
      { status: 500 },
    )
  }

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'hospital_beds',
    recordId: bed_id,
    newValue: { patient_id, admission_id: admissionId, reason },
  })

  const response: {
    admissionId: string
    admissionTaskId?: string
    bedId: string
    correlationId: string
    journeyWarnings?: string[]
  } = {
    admissionId,
    bedId: bed_id,
    correlationId,
  }
  if (admissionTaskId) response.admissionTaskId = admissionTaskId
  if (journeyWarnings.length) response.journeyWarnings = journeyWarnings

  return NextResponse.json(response, { status: 201 })
}
