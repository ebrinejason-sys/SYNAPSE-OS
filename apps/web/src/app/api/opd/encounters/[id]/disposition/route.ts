import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

const DISPOSITIONS = ['LOCAL_PHARMACY', 'EXTERNAL_PHARMACY', 'NO_MEDICATION', 'FURTHER_LAB', 'REFERRAL', 'FOLLOW_UP', 'CLINICAL_COMPLETE'] as const
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'encounter', 'disposition', 'opd')
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock
  const body = await req.json().catch(() => null) as { disposition?: string; reason?: string } | null
  const disposition = body?.disposition
  if (!disposition || !DISPOSITIONS.includes(disposition as typeof DISPOSITIONS[number])) return NextResponse.json({ error: 'Valid disposition is required' }, { status: 400 })
  const { id: encounterId } = await params
  const db = supabaseAdmin as any
  const { data: encounter } = await db.from('encounters').select('id, tenant_id, hospital_id, patient_id, disposition').eq('id', encounterId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!encounter || encounter.hospital_id !== ctx.hospitalId) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.disposition === disposition) return NextResponse.json({ encounterId, disposition, alreadyRecorded: true })
  if (disposition === 'LOCAL_PHARMACY') {
    const { data: prescription } = await db.from('clinical_prescriptions').select('id, status').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('status', 'active').limit(1).maybeSingle()
    if (!prescription) return NextResponse.json({ error: 'Local Pharmacy requires an active prescription' }, { status: 409 })
  }
  const at = new Date().toISOString()
  const { error } = await db.from('encounters').update({ disposition, disposition_reason: body?.reason ?? null, disposition_by: ctx.userId, disposition_at: at, updated_at: at }).eq('id', encounterId).eq('tenant_id', ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (disposition === 'EXTERNAL_PHARMACY' || disposition === 'NO_MEDICATION') {
    const { data: tasks } = await db.from('department_tasks').select('*').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('owner_department', 'pharmacy').in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])
    const queue = new WorkQueue()
    const updates = []
    for (const row of tasks ?? []) {
      const task = rowToDepartmentTask(row); queue.tasks.set(task.id, task)
      const cancelled = queue.cancel(task.id, `${disposition}: ${body?.reason ?? 'clinical disposition'}`)
      if (cancelled.ok) updates.push(cancelled.task)
    }
    if (updates.length) {
      const persisted = await persistWorkQueueArtifactsBestEffort(db, { tasks: updates, events: [] })
      if (persisted.errors.length) console.warn('[disposition] pharmacy task cleanup partial', persisted.errors)
    }
  }
  await logHospitalAudit({ ctx, action: disposition === 'EXTERNAL_PHARMACY' ? 'EXTERNAL_PHARMACY' : 'DOCTOR_DISPOSITION', tableName: 'encounters', recordId: encounterId, newValue: { disposition, reason: body?.reason ?? null } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: encounter.patient_id, encounterId, sourceTable: 'encounters', sourceId: encounterId, title: disposition === 'EXTERNAL_PHARMACY' ? 'External Pharmacy selected' : 'Doctor disposition recorded', summary: body?.reason ?? disposition, createdBy: ctx.userId, tags: ['encounter', 'disposition', disposition.toLowerCase()] }))
  return NextResponse.json({ encounterId, disposition, recordedAt: at })
}