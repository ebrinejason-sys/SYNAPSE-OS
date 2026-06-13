import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  if (!payload.tenant_id) {
    return NextResponse.json({ queue: [], stats: { waiting: 0, inProgress: 0, completed: 0 } })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: encounters } = await (supabaseAdmin as any)
    .from('encounters')
    .select('id, status, chief_complaint, clinical_stage, visit_date, created_at, patient_id')
    .eq('tenant_id', payload.tenant_id)
    .gte('created_at', todayStart.toISOString())
    .in('status', ['open', 'in_progress', 'completed'])
    .order('created_at', { ascending: true })
    .limit(100)

  const rows = (encounters ?? []) as Array<{
    id: string
    status: string
    chief_complaint: string | null
    clinical_stage: string | null
    visit_date: string | null
    created_at: string
    patient_id: string | null
  }>

  const patientIds = [...new Set(rows.map(r => r.patient_id).filter(Boolean))] as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: patients } = patientIds.length > 0
    ? await (supabaseAdmin as any)
        .from('patients')
        .select('id, full_name, mrn, date_of_birth, sex')
        .in('id', patientIds)
        .eq('tenant_id', payload.tenant_id)
    : { data: [] }

  const patientMap = new Map(
    ((patients ?? []) as Array<{ id: string; full_name: string; mrn: string | null; date_of_birth: string | null; sex: string | null }>)
      .map(p => [p.id, p])
  )

  const stats = {
    waiting: rows.filter(r => r.status === 'open').length,
    inProgress: rows.filter(r => r.status === 'in_progress').length,
    completed: rows.filter(r => r.status === 'completed').length,
  }

  const queue = rows.map(r => {
    const p = r.patient_id ? patientMap.get(r.patient_id) : undefined
    return {
      encounterId: r.id,
      status: r.status,
      chiefComplaint: r.chief_complaint,
      clinicalStage: r.clinical_stage,
      createdAt: r.created_at,
      patient: p
        ? { id: p.id, fullName: p.full_name, mrn: p.mrn, dateOfBirth: p.date_of_birth, sex: p.sex }
        : null,
    }
  })

  return NextResponse.json({ queue, stats })
}
