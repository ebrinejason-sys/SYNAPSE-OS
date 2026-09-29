import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/** Rejects client-supplied patient ids that do not belong to the caller's tenant. */
export async function requireTenantPatient(
  db: Db,
  tenantId: string,
  patientId: string,
): Promise<NextResponse | null> {
  const { data, error } = await db
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  return null
}

/** Rejects client-supplied encounter ids outside the caller's hospital or for another patient. */
export async function requireHospitalEncounter(
  db: Db,
  hospitalId: string,
  encounterId: string,
  patientId: string,
): Promise<NextResponse | null> {
  const { data, error } = await db
    .from('encounters')
    .select('id')
    .eq('id', encounterId)
    .eq('hospital_id', hospitalId)
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  return null
}
