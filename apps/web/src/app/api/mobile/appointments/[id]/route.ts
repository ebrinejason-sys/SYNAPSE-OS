import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const TERMINAL_STATUSES = ['cancelled_by_patient', 'cancelled_by_provider', 'cancelled', 'completed']
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

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

function canCancel(status: string, scheduledFor: string): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false
  return new Date(scheduledFor).getTime() - Date.now() > TWO_HOURS_MS
}

async function loadAppointment(user: { userId: string; role: string; tenantId: string }, id: string) {
  let query = db()
    .from('telemedicine_appointments')
    .select('id, scheduled_for, status, chief_complaint, channel, notes, tenant_id, provider_id, created_by, patient_id')
    .eq('id', id)
    .eq('is_deleted', false)

  query = user.role === 'patient'
    ? query.or(`created_by.eq.${user.userId},patient_id.eq.${user.userId}`)
    : query.eq('tenant_id', user.tenantId)

  const { data } = await query.maybeSingle()
  return data
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appt = await loadAppointment(user, id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [providerRes, tenantRes] = await Promise.all([
    appt.provider_id
      ? db().from('profiles').select('full_name, first_name, last_name').eq('id', appt.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    appt.tenant_id
      ? db().from('tenants').select('name').eq('id', appt.tenant_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const provider = providerRes.data
  const providerName = provider
    ? (provider.full_name ?? [provider.first_name, provider.last_name].filter(Boolean).join(' ')) || null
    : null

  return NextResponse.json({
    appointment: {
      id: appt.id,
      scheduledFor: appt.scheduled_for,
      status: appt.status,
      chiefComplaint: appt.chief_complaint,
      channel: appt.channel ?? 'video',
      providerName,
      facilityName: tenantRes.data?.name ?? null,
      notes: appt.notes,
      canCancel: canCancel(appt.status, appt.scheduled_for),
    },
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appt = await loadAppointment(user, id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canCancel(appt.status, appt.scheduled_for)) {
    return NextResponse.json({ error: 'This appointment can no longer be cancelled' }, { status: 400 })
  }

  const { error } = await db()
    .from('telemedicine_appointments')
    .update({ status: 'cancelled_by_patient' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
