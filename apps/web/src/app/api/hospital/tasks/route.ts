import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { rowToDepartmentTask } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'queue', 'read', 'opd')
  if (cap) return cap

  const department = req.nextUrl.searchParams.get('department')
  const encounterId = req.nextUrl.searchParams.get('encounter_id')
  const status = req.nextUrl.searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('department_tasks')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (department) query = query.eq('owner_department', department)
  if (encounterId) query = query.eq('encounter_id', encounterId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tasks = (data ?? []).map((row: Record<string, unknown>) => rowToDepartmentTask(row))

  return NextResponse.json({ tasks })
}
