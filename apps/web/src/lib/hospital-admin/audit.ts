import 'server-only'

import { supabaseAdmin } from '@synapse/db/admin'
import type { HospitalAdminContext } from './context'

export async function logHospitalAudit(params: {
  ctx: HospitalAdminContext
  action: string
  tableName: string
  recordId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from('audit_log').insert({
    tenant_id: params.ctx.tenantId,
    user_id: params.ctx.userId,
    user_role: params.ctx.role,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    created_by: params.ctx.userId,
  }).catch(() => {})
}
