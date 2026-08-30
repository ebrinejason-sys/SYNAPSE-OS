import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

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
    ? await db.from('patients').select('id, first_name, last_name, mrn, sex').in('id', patientIds)
    : { data: [] }

  const patientMap = new Map(
    (patients ?? []).map((p: { id: string; first_name: string; last_name: string; mrn: string; sex: string }) => [
      p.id,
      { ...p, fullName: `${p.first_name} ${p.last_name}`.trim() },
    ]),
  )

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
      patient: patientMap.get(b.current_patient_id) ?? { id: b.current_patient_id, fullName: 'Unknown' },
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
