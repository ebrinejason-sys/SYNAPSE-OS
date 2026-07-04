import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  bedCreateSchema,
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

async function bedsWithOccupancy(hospitalId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: beds, error } = await db
    .from('hospital_beds')
    .select('id, bed_number, ward, bed_type, building, floor, room, status, created_at, updated_at')
    .eq('hospital_id', hospitalId)
    .eq('is_deleted', false)
    .order('ward')
    .order('bed_number')

  if (error) throw new Error(error.message)

  const bedIds = (beds ?? []).map((b: { id: string }) => b.id)
  if (bedIds.length === 0) return []

  const { data: assignments } = await db
    .from('bed_assignments')
    .select('id, bed_id, patient_id, admitted_at, discharged_at, patients(id, full_name, mrn)')
    .in('bed_id', bedIds)
    .is('discharged_at', null)
    .eq('is_deleted', false)

  const byBed = new Map<string, unknown>()
  for (const a of assignments ?? []) {
    byBed.set(a.bed_id, a)
  }

  return (beds ?? []).map((bed: Record<string, unknown>) => ({
    ...bed,
    active_assignment: byBed.get(bed.id as string) ?? null,
    is_occupied: byBed.has(bed.id as string),
  }))
}

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'read')
  if (cap) return cap

  try {
    const beds = await bedsWithOccupancy(ctx.hospitalId)
    return NextResponse.json({ beds })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load beds'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = bedCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    ...parsed.data,
    hospital_id: ctx.hospitalId,
    tenant_id: ctx.tenantId,
    created_by: ctx.userId,
  }

  const { data, error } = await db.from('hospital_beds').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'hospital_beds',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ bed: data }, { status: 201 })
}
