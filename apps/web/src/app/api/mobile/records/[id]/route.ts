import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string
  const { id } = await params

  const { data: patientRows } = await db()
    .from('patients')
    .select('id')
    .eq('created_by', userId)
    .eq('is_deleted', false)
    .limit(20)

  const patientIds = (patientRows ?? []).map((p: { id: string }) => p.id)
  if (patientIds.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: encounter } = await db()
    .from('encounters')
    .select('id, chief_complaint, clinical_stage, status, created_at, tenant_id, clinician_id')
    .eq('id', id)
    .in('patient_id', patientIds)
    .eq('is_deleted', false)
    .maybeSingle()

  if (encounter) {
    const [tenantRes, vitalsRes, clinicianRes] = await Promise.all([
      encounter.tenant_id
        ? db().from('tenants').select('name').eq('id', encounter.tenant_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db()
        .from('vitals')
        .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, weight_kg, spo2')
        .eq('encounter_id', id)
        .order('recorded_at', { ascending: false })
        .limit(1),
      encounter.clinician_id
        ? db().from('profiles').select('full_name, first_name, last_name').eq('id', encounter.clinician_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const facilityName = tenantRes.data?.name ?? null
    const vitalsRow = vitalsRes.data?.[0] ?? null
    const clinician = clinicianRes.data

    return NextResponse.json({
      record: {
        id: encounter.id,
        type: 'encounter',
        title: facilityName ? `Visit at ${facilityName}` : 'Clinical visit',
        subtitle: encounter.chief_complaint,
        date: encounter.created_at,
        meta: encounter.status,
        notes: null,
        diagnoses: [],
        vitals: vitalsRow
          ? {
              temperature: vitalsRow.temperature_c,
              bpSystolic: vitalsRow.bp_systolic,
              bpDiastolic: vitalsRow.bp_diastolic,
              pulse: vitalsRow.heart_rate,
              weight: vitalsRow.weight_kg,
              spo2: vitalsRow.spo2,
            }
          : null,
        providerName: clinician
          ? (clinician.full_name ?? [clinician.first_name, clinician.last_name].filter(Boolean).join(' ')) || null
          : null,
        facilityName,
      },
    })
  }

  const { data: lab } = await db()
    .from('lab_results')
    .select('id, test_name, result_value, flag, created_at, tenant_id')
    .eq('id', id)
    .in('patient_id', patientIds)
    .maybeSingle()

  if (lab) {
    const tenantRes = lab.tenant_id
      ? await db().from('tenants').select('name').eq('id', lab.tenant_id).maybeSingle()
      : { data: null }

    return NextResponse.json({
      record: {
        id: lab.id,
        type: 'lab',
        title: lab.test_name ?? 'Lab result',
        subtitle: lab.result_value ? String(lab.result_value) : null,
        date: lab.created_at,
        meta: lab.flag,
        notes: null,
        diagnoses: [],
        vitals: null,
        providerName: null,
        facilityName: tenantRes.data?.name ?? null,
      },
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
