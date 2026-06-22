import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function parseJsonArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v)))
  }
  return []
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string

  const { data: patientProfile } = await db()
    .from('patient_profiles')
    .select('blood_group, allergies, chronic_conditions')
    .eq('id', userId)
    .maybeSingle()

  const profile = patientProfile
    ? {
        bloodGroup: (patientProfile.blood_group as string | null) ?? null,
        allergies: parseJsonArray(patientProfile.allergies),
        chronicConditions: parseJsonArray(patientProfile.chronic_conditions),
      }
    : null

  const records: Array<{
    id: string
    type: 'encounter' | 'lab' | 'profile'
    title: string
    subtitle: string | null
    date: string
    meta: string | null
  }> = []

  // Facility patient rows created by this user (linked visits)
  const { data: patientRows } = await db()
    .from('patients')
    .select('id')
    .eq('created_by', userId)
    .eq('is_deleted', false)
    .limit(20)

  const patientIds = (patientRows ?? []).map((p: { id: string }) => p.id)

  const { data: encounters } = patientIds.length > 0
    ? await db()
        .from('encounters')
        .select('id, chief_complaint, clinical_stage, status, created_at, tenant_id')
        .in('patient_id', patientIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(25)
    : { data: [] }

  for (const enc of encounters ?? []) {
    let facilityName = ''
    if (enc.tenant_id) {
      const { data: tenant } = await db()
        .from('tenants')
        .select('name')
        .eq('id', enc.tenant_id)
        .maybeSingle()
      facilityName = (tenant?.name as string) ?? ''
    }
    records.push({
      id: enc.id as string,
      type: 'encounter',
      title: facilityName ? `Visit at ${facilityName}` : 'Clinical visit',
      subtitle: (enc.chief_complaint as string | null) ?? null,
      date: enc.created_at as string,
      meta: enc.status as string,
    })
  }

  const { data: labs } = patientIds.length > 0
    ? await db()
        .from('lab_results')
        .select('id, test_name, result_value, flag, created_at')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: false })
        .limit(15)
    : { data: [] }

  for (const lab of labs ?? []) {
    records.push({
      id: lab.id as string,
      type: 'lab',
      title: (lab.test_name as string) ?? 'Lab result',
      subtitle: lab.result_value ? String(lab.result_value) : null,
      date: lab.created_at as string,
      meta: (lab.flag as string | null) ?? null,
    })
  }

  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ records, profile })
}
