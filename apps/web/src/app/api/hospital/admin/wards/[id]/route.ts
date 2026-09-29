import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  wardPatchSchema,
} from '../../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = wardPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('wards')
    .select('*')
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('wards')
    .update(parsed.data)
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'wards',
    recordId: id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ ward: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'ward', 'write')
  if (cap) return cap

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('wards')
    .select('id, name')
    .eq('id', id)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db.from('wards').update({ is_active: false }).eq('id', id).eq('hospital_id', ctx.hospitalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'DELETE',
    tableName: 'wards',
    recordId: id,
    oldValue: existing,
  })

  return NextResponse.json({ ok: true })
}
