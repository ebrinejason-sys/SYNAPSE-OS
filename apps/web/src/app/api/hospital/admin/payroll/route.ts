import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../lib/hospital-admin'
import { PAYROLL_STAFF_ROLES } from './shared'

export const dynamic = 'force-dynamic'

/** Own-facility staff with their base salary (service role; tenant scoped). */
export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'read')
  if (cap) return cap

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: staff, error } = await db
    .from('profiles')
    .select('id, full_name, role, department_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .order('full_name')
  if (error) return NextResponse.json({ error: 'Could not load staff' }, { status: 500 })

  const rows = (staff ?? []).filter((s: { role: string | null }) => PAYROLL_STAFF_ROLES.has(String(s.role ?? '')))

  const [{ data: departments }, { data: comp }] = await Promise.all([
    db.from('departments').select('id, name').eq('tenant_id', ctx.tenantId),
    db.from('staff_compensation').select('profile_id, base_salary_ugx').eq('tenant_id', ctx.tenantId),
  ])
  const deptName = new Map((departments ?? []).map((d: { id: string; name: string }) => [d.id, d.name]))
  const salary = new Map((comp ?? []).map((c: { profile_id: string; base_salary_ugx: number | string }) => [c.profile_id, Number(c.base_salary_ugx)]))

  return NextResponse.json({
    staff: rows.map((s: { id: string; full_name: string | null; role: string | null; department_id: string | null }) => ({
      id: s.id,
      full_name: s.full_name,
      role: s.role,
      department: s.department_id ? deptName.get(s.department_id) ?? null : null,
      base_salary_ugx: salary.get(s.id) ?? null,
    })),
  })
}
