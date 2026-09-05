import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, vitalsRecordSchema } from '../../../../lib/hospital-dept'
import { clinicalActionTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'round', 'write', 'ward')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'ipd')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = vitalsRecordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { encounter_id, patient_id, ...vitals } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encError } = await db
    .from('encounters')
    .select('id, patient_id, is_signed')
    .eq('id', encounter_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (encError) return NextResponse.json({ error: encError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.patient_id !== patient_id) {
    return NextResponse.json({ error: 'Patient does not match encounter' }, { status: 400 })
  }
  if (encounter.is_signed) {
    return NextResponse.json({ error: 'Cannot record vitals on signed encounter' }, { status: 409 })
  }

  const { data: row, error: vitalsError } = await db
    .from('vitals')
    .insert({
      tenant_id: ctx.tenantId,
      encounter_id,
      ...vitals,
      recorded_by: ctx.userId,
      recorded_at: new Date().toISOString(),
      is_deleted: false,
    })
    .select('id')
    .single()

  if (vitalsError) return NextResponse.json({ error: vitalsError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'vitals',
    recordId: row.id,
    newValue: { encounter_id, patient_id, ...vitals },
  })

  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    clinicalActionTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      encounterId: encounter_id,
      sourceTable: 'vitals',
      sourceId: row.id,
      title: 'Vitals recorded',
      summary: 'Nursing observations recorded for the encounter.',
      createdBy: ctx.userId,
      tags: ['nursing', 'vitals'],
    }),
  )

  return NextResponse.json({ vitalsId: row.id }, { status: 201 })
}
