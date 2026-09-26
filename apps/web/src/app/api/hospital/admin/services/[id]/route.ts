import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  gateHospitalModule,
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  servicePatchSchema,
} from '../../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'service', 'write')
  if (cap) return cap

  const billingGate = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (billingGate) return billingGate

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = servicePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('service_catalog')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('service_catalog')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'service_catalog',
    recordId: id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ service: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'service', 'write')
  if (cap) return cap

  const billingGate = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (billingGate) return billingGate

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('service_catalog')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db
    .from('service_catalog')
    .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'DELETE',
    tableName: 'service_catalog',
    recordId: id,
    oldValue: existing,
  })

  return NextResponse.json({ ok: true })
}
