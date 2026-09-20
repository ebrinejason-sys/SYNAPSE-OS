import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'queue', 'read', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const tomorrowStart = new Date()
  tomorrowStart.setHours(0, 0, 0, 0)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounters, error } = await db
    .from('encounters')
    .select('id, patient_id, chief_complaint, clinical_stage, status, visit_date')
    .eq('tenant_id', ctx.tenantId)
    .eq('hospital_id', ctx.hospitalId)
    .eq('is_deleted', false)
    .gte('visit_date', todayStart.toISOString())
    .lt('visit_date', tomorrowStart.toISOString())
    .in('status', ['open', 'in_progress', 'completed', 'signed'])
    .order('visit_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const patientIds = [...new Set((encounters ?? []).map((e: { patient_id: string }) => e.patient_id))]
  const { data: patients } = patientIds.length
    ? await db
        .from('patients')
        .select('id, full_name, mrn, dob, sex')
        .eq('tenant_id', ctx.tenantId)
        .in('id', patientIds)
    : { data: [] }

  const patientMap = new Map(
    (patients ?? []).map((p: { id: string; full_name: string; mrn: string | null; dob: string | null; sex: string | null }) => [p.id, p]),
  )

  const queue = (encounters ?? []).map((e: {
    id: string; patient_id: string; chief_complaint: string | null
    clinical_stage: string | null; status: string; visit_date: string
  }) => {
    const patient = patientMap.get(e.patient_id) as
      | { id: string; full_name: string; mrn: string | null; dob: string | null; sex: string | null }
      | undefined
    return {
      encounterId: e.id,
      patientId: e.patient_id,
      fullName: patient?.full_name ?? 'Unknown',
      mrn: patient?.mrn ?? null,
      dob: patient?.dob ?? null,
      sex: patient?.sex ?? null,
      chiefComplaint: e.chief_complaint,
      clinicalStage: e.clinical_stage,
      status: e.status,
      visitDate: e.visit_date,
    }
  })

  return NextResponse.json({ queue })
}
