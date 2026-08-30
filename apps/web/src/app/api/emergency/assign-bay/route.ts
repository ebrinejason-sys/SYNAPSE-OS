import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { edBayAssignedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, edAssignBaySchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'triage', 'assign', 'emergency')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'emergency')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = edAssignBaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { encounter_id, patient_id, bay_id } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encError } = await db
    .from('encounters')
    .select('id, patient_id, metadata')
    .eq('id', encounter_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (encError) return NextResponse.json({ error: encError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.patient_id !== patient_id) {
    return NextResponse.json({ error: 'Patient does not match encounter' }, { status: 400 })
  }

  const { data: bay, error: bayError } = await db
    .from('facility_locations')
    .select('id, code, name, location_type, metadata')
    .eq('id', bay_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (bayError) return NextResponse.json({ error: bayError.message }, { status: 500 })
  if (!bay) return NextResponse.json({ error: 'Bay not found' }, { status: 404 })

  const bayMeta = (bay.metadata as Record<string, unknown> | null) ?? {}
  if (bayMeta.current_patient_id && bayMeta.current_patient_id !== patient_id) {
    return NextResponse.json({ error: 'Bay is occupied' }, { status: 409 })
  }

  const encounterMeta = (encounter.metadata as Record<string, unknown> | null) ?? {}
  const { error: encUpdateError } = await db
    .from('encounters')
    .update({
      metadata: {
        ...encounterMeta,
        department: 'emergency',
        ed_bay_id: bay_id,
        ed_bay_code: bay.code,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', encounter_id)
    .eq('tenant_id', ctx.tenantId)

  if (encUpdateError) return NextResponse.json({ error: encUpdateError.message }, { status: 500 })

  const { error: bayUpdateError } = await db
    .from('facility_locations')
    .update({
      metadata: {
        ...bayMeta,
        current_patient_id: patient_id,
        encounter_id,
        assigned_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bay_id)
    .eq('tenant_id', ctx.tenantId)

  if (bayUpdateError) return NextResponse.json({ error: bayUpdateError.message }, { status: 500 })

  await db
    .from('department_tasks')
    .update({
      status: 'IN_PROGRESS',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result_summary: `Assigned to ${bay.name}`,
    })
    .eq('tenant_id', ctx.tenantId)
    .eq('encounter_id', encounter_id)
    .eq('task_type', 'triage')
    .eq('owner_department', 'emergency')

  void publishClinicalTimelineBestEffort(
    publishTimelineEvent,
    edBayAssignedTimelineEvent({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      encounterId: encounter_id,
      bayId: bay_id,
      bayName: bay.name,
      locationType: bay.location_type,
      createdBy: ctx.userId,
    }),
  )

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'encounters',
    recordId: encounter_id,
    newValue: { ed_bay_id: bay_id, ed_bay_code: bay.code },
  })

  return NextResponse.json({
    encounterId: encounter_id,
    bayId: bay_id,
    bayCode: bay.code,
    bayName: bay.name,
  })
}
