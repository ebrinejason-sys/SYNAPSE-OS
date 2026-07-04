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
    return NextResponse.json({
      claims: [],
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, totalAmount: 0 },
    })
  }

  const { data: rows, error } = await db()
    .from('insurance_claims')
    .select('id, patient_id, insurer_name, billed_amount, status, submitted_at, service_from')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }

  const claimRows = (rows ?? []) as Array<{
    id: string; patient_id: string | null; insurer_name: string | null
    billed_amount: number | null; status: string; submitted_at: string | null; service_from: string | null
  }>

  const patientIds = [...new Set(claimRows.map((r) => r.patient_id).filter(Boolean))] as string[]
  const patientsRes = patientIds.length
    ? await db().from('patients').select('id, full_name').in('id', patientIds)
    : { data: [] }
  const patientMap = new Map(
    (patientsRes.data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  )

  const claims = claimRows.map((r) => ({
    id: r.id,
    patientName: r.patient_id ? patientMap.get(r.patient_id) ?? 'Unknown patient' : 'Unknown patient',
    amount: Number(r.billed_amount) || 0,
    currency: 'UGX',
    insurer: r.insurer_name,
    status: r.status,
    submittedAt: r.submitted_at,
    serviceDate: r.service_from,
  }))

  const [totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'pending'),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'approved'),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'rejected'),
  ])

  const totalAmount = claims.reduce((sum, c) => sum + c.amount, 0)

  return NextResponse.json({
    claims,
    summary: {
      total: totalCount.count ?? 0,
      pending: pendingCount.count ?? 0,
      approved: approvedCount.count ?? 0,
      rejected: rejectedCount.count ?? 0,
      totalAmount,
    },
  })
}
