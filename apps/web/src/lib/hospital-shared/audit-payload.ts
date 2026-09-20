import type { HospitalContext } from './context'

export type HospitalAuditRecord = {
  ctx: HospitalContext
  action: string
  tableName: string
  recordId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

export function hospitalAuditInsertPayload(params: HospitalAuditRecord) {
  // created_by FKs to auth.users. Hospital OS staff ids live on profiles, so
  // persist actor identity on user_id (no auth.users FK) and omit created_by.
  return {
    tenant_id: params.ctx.tenantId,
    user_id: params.ctx.userId,
    user_role: params.ctx.role,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  }
}
