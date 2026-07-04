import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  settingsPatchSchema,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'settings', 'read')
  if (cap) return cap

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('hospital_settings')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'settings', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = settingsPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('hospital_settings')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  const patch = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  let result
  if (existing) {
    const { data, error } = await db
      .from('hospital_settings')
      .update(patch)
      .eq('tenant_id', ctx.tenantId)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
    await logHospitalAudit({
      ctx,
      action: 'UPDATE',
      tableName: 'hospital_settings',
      recordId: existing.id,
      oldValue: existing,
      newValue: result,
    })
  } else {
    const { data, error } = await db
      .from('hospital_settings')
      .insert({
        tenant_id: ctx.tenantId,
        created_by: ctx.userId,
        currency_code: 'UGX',
        tax_rate_percent: 0,
        ...patch,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
    await logHospitalAudit({
      ctx,
      action: 'INSERT',
      tableName: 'hospital_settings',
      recordId: result.id,
      newValue: result,
    })
  }

  return NextResponse.json({ settings: result })
}
