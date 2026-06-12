import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

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

  if (!payload.tenant_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: patient } = await (supabaseAdmin as any)
    .from('patients')
    .select('id, full_name, mrn, date_of_birth, sex, phone, address, blood_group, allergies, created_at')
    .eq('id', id)
    .eq('tenant_id', payload.tenant_id)
    .eq('is_deleted', false)
    .single()

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: encounters } = await (supabaseAdmin as any)
    .from('encounters')
    .select('id, status, chief_complaint, clinical_stage, visit_date, created_at')
    .eq('patient_id', id)
    .eq('tenant_id', payload.tenant_id)
    .order('created_at', { ascending: false })
    .limit(10)

  const encounterIds = ((encounters ?? []) as Array<{ id: string }>).map(e => e.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vitals } = encounterIds.length > 0
    ? await (supabaseAdmin as any)
        .from('vitals')
        .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, recorded_at')
        .in('encounter_id', encounterIds)
        .order('recorded_at', { ascending: false })
        .limit(1)
    : { data: [] }

  return NextResponse.json({
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      mrn: patient.mrn,
      dateOfBirth: patient.date_of_birth,
      sex: patient.sex,
      phone: patient.phone,
      address: patient.address,
      bloodGroup: patient.blood_group,
      allergies: patient.allergies,
      createdAt: patient.created_at,
    },
    encounters: (encounters ?? []).map((e: {
      id: string; status: string; chief_complaint: string | null;
      clinical_stage: string | null; visit_date: string | null; created_at: string
    }) => ({
      id: e.id,
      status: e.status,
      chiefComplaint: e.chief_complaint,
      clinicalStage: e.clinical_stage,
      visitDate: e.visit_date,
      createdAt: e.created_at,
    })),
    latestVitals: vitals?.[0]
      ? {
          bpSystolic: vitals[0].bp_systolic,
          bpDiastolic: vitals[0].bp_diastolic,
          heartRate: vitals[0].heart_rate,
          temperatureC: vitals[0].temperature_c,
          spo2: vitals[0].spo2,
          recordedAt: vitals[0].recorded_at,
        }
      : null,
  })
}
