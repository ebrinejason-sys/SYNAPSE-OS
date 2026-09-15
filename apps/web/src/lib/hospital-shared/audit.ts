import 'server-only'

import { supabaseAdmin } from '@synapse/db/admin'
import type { HospitalContext } from './context'

export type HospitalAuditRecord = {
  ctx: HospitalContext
  action: string
  tableName: string
  recordId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}

export class HospitalAuditRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HospitalAuditRequiredError'
  }
}

function insertPayload(params: HospitalAuditRecord) {
  return {
    tenant_id: params.ctx.tenantId,
    user_id: params.ctx.userId,
    user_role: params.ctx.role,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    created_by: params.ctx.userId,
  }
}

/**
 * Best-effort telemetry. Failures are swallowed. Do not use for
 * security-sensitive or clinical-state transitions.
 */
export async function logHospitalAudit(params: HospitalAuditRecord): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  try {
    const { error } = await db.from('audit_log').insert(insertPayload(params))
    if (error) {
      console.error(`[SYNAPSE] best-effort audit failed: ${error.message}`)
    }
  } catch (err) {
    console.error('[SYNAPSE] best-effort audit threw', err)
  }
}

/**
 * Required audit for clinical / security-sensitive transitions.
 * Callers must not report success to the client unless this resolves.
 * Throws HospitalAuditRequiredError so the caller can refuse success
 * without implying the domain write rolled back (idempotent retry).
 */
export async function requireHospitalAudit(params: HospitalAuditRecord): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db.from('audit_log').insert(insertPayload(params))
  if (error) {
    throw new HospitalAuditRequiredError(error.message ?? 'AUDIT_REQUIRED_FAILED')
  }
}
