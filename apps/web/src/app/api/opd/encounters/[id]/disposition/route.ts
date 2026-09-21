import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import {
  assertDeceasedPronouncementBinding,
  deathPronouncementFromRow,
} from '@synapse/db/death-pronouncement'

const DISPOSITIONS = ['LOCAL_PHARMACY', 'EXTERNAL_PHARMACY', 'NO_MEDICATION', 'FURTHER_LAB', 'REFERRAL', 'FOLLOW_UP', 'CLINICAL_COMPLETE', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'REFERRED', 'DECEASED', 'AMA', 'LEFT_BEFORE_COMPLETION'] as const
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  disposition: z.enum(DISPOSITIONS),
  reason: z.string().max(2000).optional().nullable(),
  pronouncement_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'encounter', 'disposition', 'opd')
  if (cap) return cap
  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { disposition, reason, pronouncement_id: pronouncementId } = parsed.data
  if (disposition === 'DECEASED' && !pronouncementId) {
    return NextResponse.json({ error: 'DECEASED disposition requires a pronouncement record' }, { status: 409 })
  }
  const { id: encounterId } = await params
  const db = supabaseAdmin as any
  const { data: encounter } = await db.from('encounters').select('id, tenant_id, hospital_id, patient_id, person_id, disposition').eq('id', encounterId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!encounter || encounter.hospital_id !== ctx.hospitalId) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.disposition === disposition) return NextResponse.json({ encounterId, disposition, alreadyRecorded: true })
  if (disposition === 'LOCAL_PHARMACY') {
    const { data: prescription } = await db.from('clinical_prescriptions').select('id, status').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('status', 'active').limit(1).maybeSingle()
    if (!prescription) return NextResponse.json({ error: 'Local Pharmacy requires an active prescription' }, { status: 409 })
  }
  let boundPronouncementId: string | null = null
  if (disposition === 'DECEASED' && pronouncementId) {
    const { data: row } = await db.from('death_pronouncements').select('*').eq('id', pronouncementId).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Pronouncement not found' }, { status: 404 })
    const pronouncement = deathPronouncementFromRow(row)
    try {
      assertDeceasedPronouncementBinding({
        pronouncement,
        tenantId: ctx.tenantId,
        encounterId: encounter.id,
        patientId: encounter.patient_id,
        personId: encounter.person_id ?? null,
        hospitalId: encounter.hospital_id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pronouncement not bound to this encounter'
      const notFound = message === 'DEATH_PRONOUNCEMENT_NOT_FOUND'
      return NextResponse.json({ error: notFound ? 'Pronouncement not found' : message }, { status: notFound ? 404 : 409 })
    }
    boundPronouncementId = pronouncement.id
  }
  const at = new Date().toISOString()
  const update: Record<string, unknown> = {
    disposition,
    disposition_reason: reason ?? null,
    disposition_by: ctx.userId,
    disposition_at: at,
    updated_at: at,
  }
  if (boundPronouncementId) update.death_pronouncement_id = boundPronouncementId
  const { error } = await db.from('encounters').update(update).eq('id', encounterId).eq('tenant_id', ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (disposition === 'EXTERNAL_PHARMACY' || disposition === 'NO_MEDICATION') {
    const { data: tasks } = await db.from('department_tasks').select('*').eq('tenant_id', ctx.tenantId).eq('encounter_id', encounterId).eq('owner_department', 'pharmacy').in('status', ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'])
    const queue = new WorkQueue()
    const updates = []
    for (const row of tasks ?? []) {
      const task = rowToDepartmentTask(row); queue.tasks.set(task.id, task)
      const cancelled = queue.cancel(task.id, `${disposition}: ${reason ?? 'clinical disposition'}`)
      if (cancelled.ok) updates.push(cancelled.task)
    }
    if (updates.length) {
      const persisted = await persistWorkQueueArtifactsBestEffort(db, { tasks: updates, events: [] })
      if (persisted.errors.length) console.warn('[disposition] pharmacy task cleanup partial', persisted.errors)
    }
  }
  await logHospitalAudit({ ctx, action: disposition === 'EXTERNAL_PHARMACY' ? 'EXTERNAL_PHARMACY' : 'DOCTOR_DISPOSITION', tableName: 'encounters', recordId: encounterId, newValue: { disposition, reason: reason ?? null, death_pronouncement_id: boundPronouncementId } })
  void publishClinicalTimelineBestEffort(publishTimelineEvent, clinicalActionTimelineEvent({ tenantId: ctx.tenantId, hospitalId: ctx.hospitalId, patientId: encounter.patient_id, encounterId, sourceTable: 'encounters', sourceId: encounterId, title: disposition === 'EXTERNAL_PHARMACY' ? 'External Pharmacy selected' : 'Doctor disposition recorded', summary: reason ?? disposition, createdBy: ctx.userId, tags: ['encounter', 'disposition', disposition.toLowerCase()] }))
  return NextResponse.json({ encounterId, disposition, recordedAt: at, deathPronouncementId: boundPronouncementId })
}
