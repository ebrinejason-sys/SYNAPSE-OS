import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isContextError,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'read')
  if (cap) return cap

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('profiles')
    .select('id, email, full_name, role, phone, department_id, is_deleted, created_at, last_sign_in_at, two_factor_enabled')
    .eq('tenant_id', ctx.tenantId)
    .neq('role', 'patient')
    .eq('is_deleted', false)
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data ?? [] })
}
