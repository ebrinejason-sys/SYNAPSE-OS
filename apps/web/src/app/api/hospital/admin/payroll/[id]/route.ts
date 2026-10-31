import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../../lib/hospital-admin'
import { PAYROLL_STAFF_ROLES, salaryPatchSchema } from '../shared'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

/** Set a staff member's base salary. Never writes profiles. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'write')
  if (cap) return cap

  const { id } = await params
  const parsed = salaryPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: target } = await db
    .from('profiles')
    .select('id, tenant_id, role, is_deleted')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!target || target.tenant_id !== ctx.tenantId || target.is_deleted || !PAYROLL_STAFF_ROLES.has(String(target.role ?? ''))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: previous } = await db
    .from('staff_compensation')
    .select('base_salary_ugx')
    .eq('profile_id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  const row = {
    profile_id: id,
    tenant_id: ctx.tenantId,
    base_salary_ugx: parsed.data.base_salary_ugx,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('staff_compensation').upsert(row, { onConflict: 'profile_id' })
  if (error) return NextResponse.json({ error: 'Could not save salary' }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'staff_compensation',
    recordId: id,
    oldValue: { base_salary_ugx: previous?.base_salary_ugx ?? null },
    newValue: { base_salary_ugx: parsed.data.base_salary_ugx },
  })

  return NextResponse.json({ ok: true, base_salary_ugx: parsed.data.base_salary_ugx })
}
