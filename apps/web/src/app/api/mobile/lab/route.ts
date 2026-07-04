import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) {
    return NextResponse.json({ orders: [], stats: { pending: 0, inProgress: 0, collected: 0 } })
  }

  const { data: orders, error } = await db()
    .from('encounter_orders')
    .select('id, encounter_id, order_type, status, name, created_by, created_at')
    .eq('tenant_id', tenantId)
    .eq('order_type', 'lab')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load lab orders' }, { status: 500 })
  }

  const rows = (orders ?? []) as Array<{
    id: string; encounter_id: string | null; status: string; name: string | null
    created_by: string | null; created_at: string
  }>

  const encounterIds = [...new Set(rows.map((r) => r.encounter_id).filter(Boolean))] as string[]
  const orderedByIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[]

  const [encountersRes, profilesRes] = await Promise.all([
    encounterIds.length
      ? db().from('encounters').select('id, patient_id').in('id', encounterIds)
      : Promise.resolve({ data: [] }),
    orderedByIds.length
      ? db().from('profiles').select('id, full_name, first_name, last_name').in('id', orderedByIds)
      : Promise.resolve({ data: [] }),
  ])

  const encounterPatientMap = new Map<string, string | null>(
    (encountersRes.data ?? []).map(
      (e: { id: string; patient_id: string | null }): [string, string | null] => [e.id, e.patient_id]
    )
  )
  const patientIds = [...new Set(Array.from(encounterPatientMap.values()).filter(Boolean))] as string[]

  const patientsRes = patientIds.length
    ? await db().from('patients').select('id, full_name, mrn').in('id', patientIds)
    : { data: [] }

  const patientMap = new Map<string, { full_name: string; mrn: string | null }>(
    (patientsRes.data ?? []).map(
      (p: { id: string; full_name: string; mrn: string | null }): [string, { full_name: string; mrn: string | null }] => [p.id, p]
    )
  )
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p: Record<string, string | null>) => [
      p.id,
      p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || null),
    ])
  )

  const orderList = rows.map((r) => {
    const patientId = r.encounter_id ? encounterPatientMap.get(r.encounter_id) : null
    const patient = patientId ? patientMap.get(patientId) : undefined
    return {
      id: r.id,
      patientName: patient?.full_name ?? 'Unknown patient',
      patientMrn: patient?.mrn ?? null,
      testName: r.name ?? 'Lab test',
      status: r.status,
      orderedAt: r.created_at,
      orderedBy: r.created_by ? profileMap.get(r.created_by) ?? null : null,
    }
  })

  const stats = {
    pending: rows.filter((r) => r.status === 'pending').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    collected: rows.filter((r) => r.status === 'completed').length,
  }

  return NextResponse.json({ orders: orderList, stats })
}
