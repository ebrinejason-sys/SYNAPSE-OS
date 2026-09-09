import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'
export async function POST(_req: NextRequest, { params }: { params: Promise<{ encounterId: string }> }) {
  const ctx = await requireHospitalStaffContext(); if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'encounter', 'close', 'opd'); if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd'); if (moduleBlock) return moduleBlock
  const { encounterId } = await params; const db = supabaseAdmin as any
  const { data: encounter } = await db.from('encounters').select('id, hospital_id, patient_id, status, disposition').eq('id', encounterId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!encounter || encounter.hospital_id !== ctx.hospitalId) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.status === 'completed') return NextResponse.json({ encounterId, closed: true, alreadyClosed: true })
  const { data: labs } = await db.from('lab_orders').select('id, workflow_status').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).not('workflow_status', 'in', '(RELEASED,CANCELLED,REJECTED)')
  if ((labs ?? []).length) return NextResponse.json({ error: 'Encounter cannot close while required Lab work remains', blocking: 'LAB', sourceId: labs[0].id }, { status: 409 })
  const { data: results } = await db.from('lab_results').select('id').eq('tenant_id', ctx.tenantId).eq('reviewed_at', null).eq('status', 'final').in('lab_order_id', (await db.from('lab_orders').select('id').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId)).data?.map((r: { id: string }) => r.id) ?? [])
  if ((results ?? []).length) return NextResponse.json({ error: 'Encounter cannot close while a released result awaits Doctor review', blocking: 'DOCTOR_REVIEW', sourceId: results[0].id }, { status: 409 })
  const { data: prescriptions } = await db.from('clinical_prescriptions').select('id, status, disposition').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('status', 'active')
  if ((prescriptions ?? []).some((rx: { disposition?: string | null }) => rx.disposition !== 'EXTERNAL_PHARMACY' && rx.disposition !== 'NO_MEDICATION')) return NextResponse.json({ error: 'Encounter cannot close while local Pharmacy work remains', blocking: 'PHARMACY' }, { status: 409 })
  const { data: invoice } = await db.from('billing_invoices').select('id, status, total_amount, paid_amount').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('is_deleted', false).limit(1).maybeSingle()
  if (invoice && invoice.status !== 'paid' && Number(invoice.total_amount ?? 0) > Number(invoice.paid_amount ?? 0)) return NextResponse.json({ error: 'Encounter cannot close while an invoice has an outstanding balance', blocking: 'BILLING', sourceId: invoice.id }, { status: 409 })
  const { data: pendingTasks } = await db
    .from('department_tasks')
    .select('id, task_type, title')
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounterId)
    .in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])
  if ((pendingTasks ?? []).length) return NextResponse.json({ error: 'Encounter cannot close while required work remains', blocking: pendingTasks[0].task_type, sourceId: pendingTasks[0].id }, { status: 409 })
  const at = new Date().toISOString()
  const { error } = await db.from('encounters').update({ status: 'completed', updated_at: at }).eq('id', encounterId).eq('tenant_id', ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: 'ENCOUNTER_CLOSED', tableName: 'encounters', recordId: encounterId, newValue: { status: 'completed' } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: encounter.patient_id, encounterId, sourceTable: 'encounters', sourceId: encounterId, title: 'Encounter closed', summary: 'Clinical and financial work complete', createdBy: ctx.userId, tags: ['encounter', 'closed'] }))
  return NextResponse.json({ encounterId, closed: true, closedAt: at })
}