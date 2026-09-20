import 'server-only'

import { supabaseAdmin } from '@synapse/db/admin'
import { hospitalAuditInsertPayload, type HospitalAuditRecord } from './audit-payload'

export type { HospitalAuditRecord }
export { hospitalAuditInsertPayload }

export class HospitalAuditRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HospitalAuditRequiredError'
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
    const { error } = await db.from('audit_log').insert(hospitalAuditInsertPayload(params))
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
  const { error } = await db.from('audit_log').insert(hospitalAuditInsertPayload(params))
  if (error) {
    throw new HospitalAuditRequiredError(error.message ?? 'AUDIT_REQUIRED_FAILED')
  }
}
