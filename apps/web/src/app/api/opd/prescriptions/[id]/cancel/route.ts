import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext(); if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'prescription', 'cancel', 'opd'); if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd'); if (moduleBlock) return moduleBlock
  const body = await req.json().catch(() => null) as { reason?: string } | null
  if (!body?.reason?.trim()) return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
  const { id } = await params; const db = supabaseAdmin as any
  const { data: rx } = await db.from('clinical_prescriptions').select('*').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  if (rx.status === 'dispensed') return NextResponse.json({ error: 'Prescription has already been dispensed. Use the Pharmacy correction workflow.' }, { status: 409 })
  if (rx.status === 'cancelled') return NextResponse.json({ prescriptionId: id, cancelled: true, alreadyCancelled: true })
  const at = new Date().toISOString()
  const { error } = await db.from('clinical_prescriptions').update({ status: 'cancelled', cancellation_reason: body.reason.trim(), disposition: 'CANCELLED', disposition_reason: body.reason.trim(), disposition_by: ctx.userId, disposition_at: at, updated_at: at }).eq('id', id).eq('tenant_id', ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: taskRows } = await db.from('department_tasks').select('*').eq('tenant_id', ctx.tenantId).eq('source_resource', 'clinical_prescriptions').eq('source_id', id).eq('task_type', 'prescription').in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])
  const queue = new WorkQueue(); const tasks = []
  for (const row of taskRows ?? []) { const task = rowToDepartmentTask(row); queue.tasks.set(task.id, task); const cancelled = queue.cancel(task.id, `Prescription cancelled: ${body.reason.trim()}`); if (cancelled.ok) tasks.push(cancelled.task) }
  if (tasks.length) await persistWorkQueueArtifactsBestEffort(db, { tasks, events: [] })
  await logHospitalAudit({ ctx, action: 'PRESCRIPTION_CANCELLED', tableName: 'clinical_prescriptions', recordId: id, newValue: { status: 'cancelled', reason: body.reason.trim() } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: rx.patient_id, encounterId: rx.encounter_id, sourceTable: 'clinical_prescriptions', sourceId: id, title: 'Prescription cancelled', summary: body.reason.trim(), createdBy: ctx.userId, tags: ['prescription', 'cancelled'] }))
  return NextResponse.json({ prescriptionId: id, cancelled: true, cancelledAt: at })
}