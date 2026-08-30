import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'triage', 'assign', 'emergency')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'emergency')
  if (moduleBlock) return moduleBlock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('facility_locations')
    .select('id, code, name, location_type, metadata, is_active')
    .eq('tenant_id', ctx.tenantId)
    .in('location_type', ['bay', 'resuscitation'])
    .eq('is_active', true)
    .order('code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bays = (data ?? []).map((row: {
    id: string
    code: string
    name: string
    location_type: string
    metadata: { current_patient_id?: string; encounter_id?: string } | null
  }) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    locationType: row.location_type,
    occupied: Boolean(row.metadata?.current_patient_id),
    currentPatientId: row.metadata?.current_patient_id ?? null,
    currentEncounterId: row.metadata?.encounter_id ?? null,
  }))

  return NextResponse.json({ bays })
}
