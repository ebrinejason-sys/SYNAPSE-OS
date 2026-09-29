import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  bedPatchSchema,
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = bedPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('hospital_beds')
    .select('*')
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('hospital_beds')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'hospital_beds',
    recordId: id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ bed: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('hospital_beds')
    .select('*')
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db
    .from('hospital_beds')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'DELETE',
    tableName: 'hospital_beds',
    recordId: id,
    oldValue: existing,
  })

  return NextResponse.json({ ok: true })
}
