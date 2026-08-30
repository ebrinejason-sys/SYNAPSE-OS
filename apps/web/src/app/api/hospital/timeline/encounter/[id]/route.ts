import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

type TimelineRow = {
  id: string
  event_type: string
  title: string
  summary: string | null
  event_date: string
  severity: string | null
  source_table: string | null
  source_id: string | null
  tags: string[] | null
  payload: Record<string, unknown> | null
  created_at: string
}

function eventMatchesEncounter(row: TimelineRow, encounterId: string): boolean {
  const payload = row.payload ?? {}
  const payloadEncounter =
    payload.encounterId ?? payload.encounter_id ?? null
  if (payloadEncounter === encounterId) return true
  if (row.source_table === 'encounters' && row.source_id === encounterId) return true
  return false
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'queue', 'read', 'opd')
  if (cap) return cap

  const { id: encounterId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encError } = await db
    .from('encounters')
    .select('id, patient_id, chief_complaint, status, visit_date')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (encError) return NextResponse.json({ error: encError.message }, { status: 500 })
  if (!encounter?.patient_id) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  }

  const { data: rows, error: timelineError } = await db
    .from('patient_timeline_events')
    .select(
      'id, event_type, title, summary, event_date, severity, source_table, source_id, tags, payload, created_at',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('patient_id', encounter.patient_id)
    .eq('is_deleted', false)
    .order('event_date', { ascending: false })
    .limit(200)

  if (timelineError) {
    return NextResponse.json({ error: timelineError.message }, { status: 500 })
  }

  const events = ((rows ?? []) as TimelineRow[]).filter((row) =>
    eventMatchesEncounter(row, encounterId),
  )

  return NextResponse.json({
    encounter: {
      id: encounter.id,
      patientId: encounter.patient_id,
      chiefComplaint: encounter.chief_complaint,
      status: encounter.status,
      visitDate: encounter.visit_date,
    },
    events,
  })
}
