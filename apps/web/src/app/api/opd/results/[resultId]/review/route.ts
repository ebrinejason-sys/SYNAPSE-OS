import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'result', 'review', 'opd')
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock
  const { resultId } = await params
  const db = supabaseAdmin as any
  const { data: result, error } = await db
    .from('lab_results')
    .select('id, lab_order_id, patient_id, status, released_to_patient_at, lab_orders!inner(id, tenant_id, encounter_id, hospital_id, ordered_by, workflow_status, test_name)')
    .eq('id', resultId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 })
  const order = Array.isArray(result.lab_orders) ? result.lab_orders[0] : result.lab_orders
  if (!order || order.tenant_id !== ctx.tenantId || order.hospital_id !== ctx.hospitalId) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 })
  }
  if (result.status !== 'final' || order.workflow_status !== 'RELEASED' || !result.released_to_patient_at) {
    return NextResponse.json({ error: 'Result must be released before it can be reviewed' }, { status: 409 })
  }
  const reviewedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('lab_results')
    .update({ reviewed_by: ctx.userId, reviewed_at: reviewedAt })
    .eq('id', resultId)
    .eq('tenant_id', ctx.tenantId)
    .is('reviewed_at', null)
    .select('id, reviewed_by, reviewed_at')
    .maybeSingle()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  if (!updated) return NextResponse.json({ resultId, reviewed: true, alreadyReviewed: true })

  const { data: reviewTask } = await db
    .from('department_tasks').select('*').eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', order.encounter_id).eq('source_resource', 'lab_results')
    .eq('source_id', resultId).eq('task_type', 'doctor_result_review').maybeSingle()
  if (reviewTask) {
    const queue = new WorkQueue()
    const task = rowToDepartmentTask(reviewTask)
    queue.tasks.set(task.id, task)
    if (task.status === 'REQUESTED') queue.start(task.id, ctx.userId)
    if (queue.get(task.id)?.status === 'IN_PROGRESS') queue.complete(task.id, 'Result reviewed by clinician', ctx.userId)
    const completed = queue.get(task.id)
    if (completed?.status === 'COMPLETED') {
      const persisted = await persistWorkQueueArtifactsBestEffort(db, { tasks: [completed], events: [] })
      if (persisted.errors.length) console.warn('[result-review] task persistence partial', persisted.errors)
    }
  }
  const { data: prescriptions } = await db.from('clinical_prescriptions').select('id, status, pharmacy_tenant_id').eq('tenant_id', ctx.tenantId).eq('encounter_id', order.encounter_id).in('status', ['active', 'verified'])
  const localPrescription = (prescriptions ?? []).find((item: { pharmacy_tenant_id?: string | null }) => item.pharmacy_tenant_id)
  if (localPrescription) {
    const queue = new WorkQueue()
    const task = queue.create({
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      hospitalId: ctx.hospitalId,
      patientId: result.patient_id,
      encounterId: order.encounter_id,
      requesterId: ctx.userId,
      ownerDepartment: 'pharmacy',
      ownerRole: 'pharmacist',
      taskType: 'prescription',
      title: 'Prescription awaiting dispensing',
      sourceResource: 'clinical_prescriptions',
      sourceId: localPrescription.id,
      correlationId: order.encounter_id,
      idempotencyKey: `clinical_prescriptions:${localPrescription.id}:prescription`,
    })
    if (task.ok) {
      const persisted = await persistWorkQueueArtifactsBestEffort(db, { tasks: [task.task], events: [] })
      if (persisted.errors.length) console.warn('[result-review] pharmacy handoff partial', persisted.errors)
    }
  } else {
    const { data: invoice } = await db.from('billing_invoices').select('id, status, total_amount, paid_amount').eq('tenant_id', ctx.tenantId).eq('encounter_id', order.encounter_id).eq('is_deleted', false).limit(1).maybeSingle()
    if (invoice && invoice.status !== 'paid' && Number(invoice.total_amount ?? 0) > Number(invoice.paid_amount ?? 0)) {
      const queue = new WorkQueue()
      const task = queue.create({
        tenantId: ctx.tenantId,
        facilityId: ctx.hospitalId,
        hospitalId: ctx.hospitalId,
        patientId: result.patient_id,
        encounterId: order.encounter_id,
        requesterId: ctx.userId,
        ownerDepartment: 'billing',
        ownerRole: 'cashier',
        taskType: 'billing',
        title: 'Payment required',
        sourceResource: 'billing_invoices',
        sourceId: invoice.id,
        correlationId: order.encounter_id,
        idempotencyKey: `billing_invoices:${invoice.id}:payment`,
      })
      if (task.ok) {
        const persisted = await persistWorkQueueArtifactsBestEffort(db, { tasks: [task.task], events: [] })
        if (persisted.errors.length) console.warn('[result-review] billing handoff partial', persisted.errors)
      }
    }
  }
  await logHospitalAudit({ ctx, action: 'RESULT_REVIEWED', tableName: 'lab_results', recordId: resultId, newValue: { reviewed_by: ctx.userId, reviewed_at: reviewedAt, encounter_id: order.encounter_id } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: result.patient_id, encounterId: order.encounter_id, sourceTable: 'lab_results', sourceId: resultId, title: 'Lab result reviewed', summary: order.test_name, createdBy: ctx.userId, tags: ['laboratory', 'result_review'] }))
  return NextResponse.json({ resultId, encounterId: order.encounter_id, reviewed: true, reviewedBy: ctx.userId, reviewedAt })
}