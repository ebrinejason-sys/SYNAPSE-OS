import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  blockingLocalPharmacyPrescriptions,
  evaluateEncounterCloseGate,
} from '@synapse/db/encounter-close-gate'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'encounter', 'close', 'opd')
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: encounter } = await db
    .from('encounters')
    .select('id, hospital_id, patient_id, status, disposition')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  const { data: labs } = await db
    .from('lab_orders')
    .select('id, workflow_status')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .not('workflow_status', 'in', '(RELEASED,CANCELLED,REJECTED)')

  const { data: orderRows } = await db
    .from('lab_orders')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
  const orderIds = (orderRows ?? []).map((r: { id: string }) => r.id)
  const { data: results } = orderIds.length
    ? await db
        .from('lab_results')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('reviewed_at', null)
        .eq('status', 'final')
        .in('lab_order_id', orderIds)
    : { data: [] }

  const { data: prescriptions } = await db
    .from('clinical_prescriptions')
    .select('id, status, disposition')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .eq('status', 'active')

  const { data: invoice } = await db
    .from('billing_invoices')
    .select('id, status, total_amount, paid_amount')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .eq('is_deleted', false)
    .limit(1)
    .maybeSingle()

  const { data: pendingTasks } = await db
    .from('department_tasks')
    .select('id, task_type, title')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])

  const decision = evaluateEncounterCloseGate({
    encounterExists: Boolean(encounter),
    disposition: encounter?.disposition ?? null,
    hospitalMatches: Boolean(encounter && encounter.hospital_id === ctx.hospitalId),
    status: encounter?.status ?? null,
    openLabOrderIds: (labs ?? []).map((row: { id: string }) => row.id),
    unreviewedFinalResultIds: (results ?? []).map((row: { id: string }) => row.id),
    blockingActivePrescriptionIds: blockingLocalPharmacyPrescriptions(prescriptions ?? []),
    invoice: invoice
      ? {
          id: String(invoice.id),
          status: String(invoice.status ?? ''),
          totalAmount: Number(invoice.total_amount ?? 0),
          paidAmount: Number(invoice.paid_amount ?? 0),
        }
      : null,
    pendingTask: (pendingTasks ?? [])[0]
      ? { id: String(pendingTasks[0].id), taskType: String(pendingTasks[0].task_type) }
      : null,
  })

  if (!decision.ok) {
    const status = decision.blocking === 'NOT_FOUND' ? 404 : 409
    return NextResponse.json(
      { error: decision.error, blocking: decision.blocking, sourceId: decision.sourceId },
      { status },
    )
  }
  if (decision.alreadyClosed) {
    return NextResponse.json({ encounterId, closed: true, alreadyClosed: true })
  }

  const at = new Date().toISOString()
  const { error } = await db
    .from('encounters')
    .update({ status: 'completed', updated_at: at })
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'ENCOUNTER_CLOSED',
    tableName: 'encounters',
    recordId: encounterId,
    newValue: { status: 'completed' },
  })
  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    clinicalActionTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: encounter.patient_id,
      encounterId,
      sourceTable: 'encounters',
      sourceId: encounterId,
      title: 'Encounter closed',
      summary: 'Clinical and financial work complete',
      createdBy: ctx.userId,
      tags: ['encounter', 'closed'],
    }),
  )
  return NextResponse.json({ encounterId, closed: true, closedAt: at })
}
