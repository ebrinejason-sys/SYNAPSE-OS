import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

async function authUser(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return null

  const { valid } = await validateSession(token)
  if (!valid) return null

  return {
    userId: payload.sub as string,
    role: (payload.role as string) ?? '',
    tenantId: (payload.tenant_id as string) || '',
  }
}

export async function GET(req: NextRequest) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()
  const isPatient = user.role === 'patient'

  let query = db()
    .from('telemedicine_appointments')
    .select('id, scheduled_for, status, chief_complaint, channel, tenant_id, provider_id')
    .eq('is_deleted', false)
    .gte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(30)

  if (isPatient) {
    query = query.or(`created_by.eq.${user.userId},patient_id.eq.${user.userId}`)
  } else if (user.tenantId) {
    query = query.eq('tenant_id', user.tenantId)
  } else {
    return NextResponse.json({ appointments: [] })
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to load appointments' }, { status: 500 })
  }

  const rows = data ?? []
  const providerIds = [...new Set(rows.map((r: { provider_id: string }) => r.provider_id).filter(Boolean))]
  const tenantIds = [...new Set(rows.map((r: { tenant_id: string | null }) => r.tenant_id).filter(Boolean))]

  const [providersRes, tenantsRes] = await Promise.all([
    providerIds.length
      ? db().from('profiles').select('id, full_name, first_name, last_name').in('id', providerIds)
      : Promise.resolve({ data: [] }),
    tenantIds.length
      ? db().from('tenants').select('id, name').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
  ])

  const providerMap = new Map(
    (providersRes.data ?? []).map((p: Record<string, string | null>) => [
      p.id,
      p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || null),
    ])
  )
  const tenantMap = new Map(
    (tenantsRes.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name])
  )

  const appointments = rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    scheduledFor: row.scheduled_for as string,
    status: row.status as string,
    chiefComplaint: (row.chief_complaint as string | null) ?? null,
    channel: (row.channel as string) ?? 'video',
    providerName: providerMap.get(row.provider_id as string) ?? null,
    facilityName: row.tenant_id ? tenantMap.get(row.tenant_id as string) ?? null : null,
  }))

  return NextResponse.json({ appointments })
}
