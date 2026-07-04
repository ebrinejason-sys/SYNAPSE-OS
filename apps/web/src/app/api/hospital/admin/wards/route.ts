import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  wardCreateSchema,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'read')
  if (cap) return cap

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: wards, error } = await db
    .from('wards')
    .select('id, name, capacity, is_active, created_at')
    .eq('hospital_id', ctx.hospitalId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: beds } = await db
    .from('hospital_beds')
    .select('id, ward')
    .eq('hospital_id', ctx.hospitalId)
    .eq('is_deleted', false)

  const bedRows = (beds ?? []) as Array<{ id: string; ward: string }>
  const bedIds = bedRows.map((b) => b.id)

  const { data: assignments } = bedIds.length
    ? await db
        .from('bed_assignments')
        .select('bed_id')
        .in('bed_id', bedIds)
        .is('discharged_at', null)
        .eq('is_deleted', false)
    : { data: [] }

  const occupiedBedIds = new Set((assignments ?? []).map((a: { bed_id: string }) => a.bed_id))

  const bedsByWard = new Map<string, { total: number; occupied: number }>()
  for (const bed of bedRows) {
    const entry = bedsByWard.get(bed.ward) ?? { total: 0, occupied: 0 }
    entry.total += 1
    if (occupiedBedIds.has(bed.id)) entry.occupied += 1
    bedsByWard.set(bed.ward, entry)
  }

  const result = (wards ?? []).map((w: { id: string; name: string }) => ({
    ...w,
    beds_total: bedsByWard.get(w.name)?.total ?? 0,
    beds_occupied: bedsByWard.get(w.name)?.occupied ?? 0,
  }))

  return NextResponse.json({ wards: result })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = wardCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    ...parsed.data,
    hospital_id: ctx.hospitalId,
  }

  const { data, error } = await db.from('wards').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'wards',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ ward: data }, { status: 201 })
}
