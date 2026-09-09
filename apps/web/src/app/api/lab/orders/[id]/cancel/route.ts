import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { LabWorkflow } from '@synapse/db/lab-workflow'
import { rowToLabOrder, persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext(); if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'order', 'cancel', 'lab'); if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'lab'); if (moduleBlock) return moduleBlock
  const body = await req.json().catch(() => null) as { reason?: string } | null
  if (!body?.reason?.trim()) return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
  const { id } = await params; const db = supabaseAdmin as any
  const { data: row, error } = await db.from('lab_orders').select('*').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
  const order = rowToLabOrder(row)
  if (order.status === 'CANCELLED') return NextResponse.json({ orderId: id, cancelled: true, alreadyCancelled: true })
  const lab = new LabWorkflow([order])
  let cancelledOrder
  try {
    cancelledOrder = lab.transition(id, 'CANCELLED', { rejectionNote: body.reason.trim() })
  } catch (transitionError) {
    return NextResponse.json({ error: 'This Lab order can no longer be cancelled', detail: transitionError instanceof Error ? transitionError.message : 'illegal transition' }, { status: 409 })
  }
  const at = new Date().toISOString()
  const persisted = await persistLabOrderBestEffort(db, { ...cancelledOrder, rejectionNote: body.reason.trim() })
  if (!persisted.ok) return NextResponse.json({ error: persisted.error }, { status: 500 })
  await db.from('lab_orders').update({ cancellation_reason: body.reason.trim(), cancelled_by: ctx.userId, cancelled_at: at }).eq('id', id).eq('tenant_id', ctx.tenantId)
  const { data: taskRows } = await db.from('department_tasks').select('*').eq('tenant_id', ctx.tenantId).eq('source_resource', 'lab_orders').eq('source_id', id).in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])
  const queue = new WorkQueue(); const tasks = []
  for (const taskRow of taskRows ?? []) { const task = rowToDepartmentTask(taskRow); queue.tasks.set(task.id, task); const cancelled = queue.cancel(task.id, `Lab order cancelled: ${body.reason.trim()}`); if (cancelled.ok) tasks.push(cancelled.task) }
  if (tasks.length) await persistWorkQueueArtifactsBestEffort(db, { tasks, events: [] })
  await logHospitalAudit({ ctx, action: 'LAB_ORDER_CANCELLED', tableName: 'lab_orders', recordId: id, newValue: { status: 'CANCELLED', reason: body.reason.trim() } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: order.patientId, encounterId: order.encounterId, sourceTable: 'lab_orders', sourceId: id, title: 'Lab order cancelled', summary: body.reason.trim(), createdBy: ctx.userId, tags: ['laboratory', 'cancelled'] }))
  return NextResponse.json({ orderId: id, cancelled: true, cancelledAt: at })
}