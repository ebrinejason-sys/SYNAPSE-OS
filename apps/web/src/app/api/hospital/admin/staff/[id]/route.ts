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

/**
 * Profile roles a facility administrator may manage. Platform operators,
 * pharmacy users, patients and any other role are outside facility staff scope
 * and are answered as not found, even when they share the facility tenant_id.
 */
const FACILITY_STAFF_TARGET_ROLES = new Set([
  'hospital_admin', 'admin', 'doctor', 'nurse', 'midwife', 'clinician', 'clinical_officer',
  'radiologist', 'radiographer', 'physiotherapist', 'receptionist', 'lab_admin', 'lab_scientist',
  'lab_technician', 'billing_officer', 'pharmacist', 'records_officer',
])
/** Roles that administer the facility; the last active one may not be removed. */
const FACILITY_ADMIN_ROLES = ['hospital_admin', 'admin']

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

  if (!existing || existing.tenant_id !== ctx.tenantId || !FACILITY_STAFF_TARGET_ROLES.has(String(existing.role ?? ''))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Server-side self-protection: an admin may not deactivate their own staff
  // assignments or change their own role (either can lock the facility out of
  // administration). Department changes on self remain allowed.
  const changesOwnRole =
    parsed.data.role !== undefined && String(parsed.data.role) !== String(existing.role ?? '')
  if (id === ctx.userId && (parsed.data.is_active === false || changesOwnRole)) {
    await logHospitalAudit({
      ctx,
      action: 'SELF_LIFECYCLE_BLOCKED',
      tableName: 'profiles',
      recordId: id,
      newValue: {
        attempted: parsed.data.is_active === false ? 'deactivate' : 'role_change',
        ...(changesOwnRole ? { role: parsed.data.role } : {}),
      },
    })
    return NextResponse.json(
      { error: 'You cannot deactivate or change the role of your own account. Ask another administrator.' },
      { status: 403 },
    )
  }

  // Last-admin protection: never leave the facility without an active administrator.
  const targetIsAdmin = FACILITY_ADMIN_ROLES.includes(String(existing.role ?? ''))
  const removesAdmin =
    parsed.data.is_active === false ||
    (parsed.data.role !== undefined && !FACILITY_ADMIN_ROLES.includes(String(parsed.data.role)))
  if (targetIsAdmin && removesAdmin) {
    const { data: otherAdmins } = await db
      .from('profiles')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .in('role', FACILITY_ADMIN_ROLES)
      .eq('is_deleted', false)
      .neq('id', id)
    if (!Array.isArray(otherAdmins) || otherAdmins.length === 0) {
      return NextResponse.json(
        { error: 'This is the last active facility administrator. Add another administrator first.', code: 'LAST_FACILITY_ADMIN' },
        { status: 409 },
      )
    }
  }

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
      .eq('tenant_id', ctx.tenantId)
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
