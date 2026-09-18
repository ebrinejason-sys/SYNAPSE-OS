import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  staffRolePatchSchema,
} from '../../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'write')
  if (cap) return cap

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = staffRolePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: existing } = await db
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (parsed.data.department_id) {
    const { data: department } = await db
      .from('departments')
      .select('id')
      .eq('id', parsed.data.department_id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()
    if (!department) return NextResponse.json({ error: 'Department is outside this facility' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.role !== undefined) patch.role = parsed.data.role
  if (parsed.data.department_id !== undefined) patch.department_id = parsed.data.department_id

  if (parsed.data.is_active === false) {
    await db
      .from('staff_scope_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('profile_id', id)
      .eq('tenant_id', ctx.tenantId)
  } else if (parsed.data.is_active === true) {
    await db
      .from('staff_scope_assignments')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('profile_id', id)
      .eq('tenant_id', ctx.tenantId)
  }

  if (Object.keys(patch).length === 0 && parsed.data.is_active === undefined) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  }

  let data = existing
  if (Object.keys(patch).length > 0) {
    const updated = await db
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select('id, email, full_name, role, department_id, is_deleted')
      .single()
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 })
    data = updated.data
  }

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'profiles',
    recordId: id,
    oldValue: { role: existing.role, department_id: existing.department_id },
    newValue: patch,
  })

  return NextResponse.json({ staff: data })
}
