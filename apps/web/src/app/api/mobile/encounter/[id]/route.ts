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

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const { data: encounter } = await db()
    .from('encounters')
    .select('id, status, chief_complaint, clinical_stage, created_at, patient_id, clinician_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!encounter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [patientRes, vitalsRes, clinicianRes] = await Promise.all([
    encounter.patient_id
      ? db()
          .from('patients')
          .select('id, full_name, mrn, dob, sex, blood_group')
          .eq('id', encounter.patient_id)
          .eq('tenant_id', tenantId)
          .eq('is_deleted', false)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db()
      .from('vitals')
      .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, weight_kg, height_cm')
      .eq('encounter_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1),
    encounter.clinician_id
      ? db()
          .from('profiles')
          .select('full_name, first_name, last_name')
          .eq('id', encounter.clinician_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const patient = patientRes.data
  const vitalsRow = vitalsRes.data?.[0] ?? null
  const clinician = clinicianRes.data

  return NextResponse.json({
    encounter: {
      encounterId: encounter.id,
      status: encounter.status,
      chiefComplaint: encounter.chief_complaint,
      clinicalStage: encounter.clinical_stage,
      createdAt: encounter.created_at,
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.full_name,
            mrn: patient.mrn,
            dateOfBirth: patient.dob,
            sex: patient.sex,
            bloodGroup: patient.blood_group,
          }
        : null,
      vitals: vitalsRow
        ? {
            temperature: vitalsRow.temperature_c,
            bpSystolic: vitalsRow.bp_systolic,
            bpDiastolic: vitalsRow.bp_diastolic,
            pulse: vitalsRow.heart_rate,
            weight: vitalsRow.weight_kg,
            height: vitalsRow.height_cm,
            spo2: vitalsRow.spo2,
          }
        : null,
      providerName: clinician
        ? (clinician.full_name ?? [clinician.first_name, clinician.last_name].filter(Boolean).join(' ')) || null
        : null,
    },
  })
}
