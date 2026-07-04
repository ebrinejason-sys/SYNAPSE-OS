import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  auditQuerySchema,
  isContextError,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'audit', 'read')
  if (cap) return cap

  const url = new URL(req.url)
  const parsed = auditQuerySchema.safeParse({
    table_name: url.searchParams.get('table_name') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    user_id: url.searchParams.get('user_id') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { table_name, action, user_id, from, to, limit, offset } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('audit_log')
    .select('id, action, table_name, record_id, user_id, user_role, old_value, new_value, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (table_name) query = query.eq('table_name', table_name)
  if (action) query = query.eq('action', action)
  if (user_id) query = query.eq('user_id', user_id)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [], limit, offset })
}
