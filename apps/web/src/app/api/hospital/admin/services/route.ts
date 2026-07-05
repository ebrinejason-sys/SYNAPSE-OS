import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  gateHospitalModule,
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  serviceCreateSchema,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'service', 'read')
  if (cap) return cap

  const billingGate = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (billingGate) return billingGate

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('service_catalog')
    .select('id, name, service_type, price, currency, is_active, created_at, updated_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ services: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'service', 'write')
  if (cap) return cap

  const billingGate = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (billingGate) return billingGate

  const body = await req.json().catch(() => null)
  const parsed = serviceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    ...parsed.data,
    tenant_id: ctx.tenantId,
    created_by: ctx.userId,
    currency: parsed.data.currency ?? 'UGX',
  }

  const { data, error } = await db.from('service_catalog').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'service_catalog',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ service: data }, { status: 201 })
}
