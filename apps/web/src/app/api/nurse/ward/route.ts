import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask } from '@synapse/db/work-queue-persist'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'bed', 'read', 'ward')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'ipd')
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: beds, error: bedError } = await db
    .from('hospital_beds')
    .select('id, ward, room, bed_number, status, current_patient_id, bed_type')
    .eq('hospital_id', ctx.hospitalId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .order('ward')

  if (bedError) return NextResponse.json({ error: bedError.message }, { status: 500 })

  const patientIds = [...new Set((beds ?? []).map((b: { current_patient_id: string | null }) => b.current_patient_id).filter(Boolean))]
  const { data: patients } = patientIds.length
    ? await db.from('patients').select('id, first_name, last_name, mrn, sex').eq('tenant_id', ctx.tenantId).in('id', patientIds)
    : { data: [] }

  const patientMap = new Map(
    (patients ?? []).map((p: { id: string; first_name: string; last_name: string; mrn: string; sex: string }) => [
      p.id,
      { ...p, fullName: `${p.first_name} ${p.last_name}`.trim() },
    ]),
  )

  const { data: encounters } = patientIds.length
    ? await db
        .from('encounters')
        .select('id, patient_id, status, visit_date')
        .eq('tenant_id', ctx.tenantId)
        .eq('hospital_id', ctx.hospitalId)
        .in('patient_id', patientIds)
        .eq('is_deleted', false)
        .in('status', ['open', 'in_progress', 'completed'])
        .order('visit_date', { ascending: false })
    : { data: [] }

  const encounterMap = new Map<string, string>()
  for (const encounter of encounters ?? []) {
    if (!encounterMap.has(encounter.patient_id)) encounterMap.set(encounter.patient_id, encounter.id)
  }

  const { data: tasks } = await db
    .from('department_tasks')
    .select('id, patient_id, encounter_id, task_type, title, status, owner_department, priority, created_at')
    .eq('tenant_id', ctx.tenantId)
    .in('owner_department', ['inpatient', 'medical_ward', 'nursing'])
    .in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'])
    .order('created_at', { ascending: false })
    .limit(50)

  const occupied = (beds ?? [])
    .filter((b: { current_patient_id: string | null }) => b.current_patient_id)
    .map((b: { id: string; ward: string; room: string | null; bed_number: string; current_patient_id: string; status: string }) => ({
      bedId: b.id,
      ward: b.ward,
      room: b.room,
      bedNumber: b.bed_number,
      status: b.status,
      patient: {
        ...(patientMap.get(b.current_patient_id) ?? { id: b.current_patient_id, fullName: 'Unknown' }),
        encounterId: encounterMap.get(b.current_patient_id) ?? null,
      },
    }))

  return NextResponse.json({
    occupiedBeds: occupied,
    openTasks: tasks ?? [],
    bedSummary: {
      total: beds?.length ?? 0,
      occupied: occupied.length,
      available: (beds?.length ?? 0) - occupied.length,
    },
  })
}

export async function POST(req: Request) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'round', 'write', 'ward')
  if (cap) return cap

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const taskId = typeof body?.taskId === 'string' ? body.taskId : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!taskId || !['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'].includes(status)) {
    return NextResponse.json({ error: 'taskId and a valid nursing status are required' }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { data: row, error: loadError } = await db
    .from('department_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('tenant_id', ctx.tenantId)
    .in('owner_department', ['inpatient', 'medical_ward', 'nursing'])
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Nursing task not found' }, { status: 404 })

  const task = rowToDepartmentTask(row)
  const queue = new WorkQueue()
  queue.tasks.set(task.id, task)
  const transition = queue.transition(task.id, status as never, {
    actorId: ctx.userId,
    assignedTo: ctx.userId,
    resultSummary: typeof body?.resultSummary === 'string' ? body.resultSummary : undefined,
  })
  if (!transition.ok) return NextResponse.json({ error: transition.error }, { status: 409 })

  const updated = transition.task
  const { error: updateError } = await db
    .from('department_tasks')
    .update({
      status: updated.status,
      assigned_to: updated.assignedTo,
      accepted_at: updated.acceptedAt,
      completed_at: updated.completedAt,
      result_summary: updated.resultSummary,
      updated_at: updated.updatedAt,
    })
    .eq('id', task.id)
    .eq('tenant_id', ctx.tenantId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ task: updated })
}
