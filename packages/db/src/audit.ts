// packages/db/src/audit.ts
import { supabaseAdmin } from './admin'

export interface AuditEntry {
  actor_id?: string
  actor_email?: string
  action: string
  resource_type: string
  resource_id?: string
  resource_name?: string
  tenant_id?: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  app_surface?: 'web' | 'pharmacy' | 'mobile' | 'api'
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Audit failure must never break the calling operation
    console.error('[AUDIT FAILED]', entry.action, error)
  }
}

export async function logPHIAccess(params: {
  accessor_id: string
  accessor_role: string
  patient_id: string
  record_type: string
  access_reason?: string
  tenant_id: string
}): Promise<void> {
  try {
    await supabaseAdmin.from('phi_access_log').insert({
      ...params,
      accessed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[PHI AUDIT FAILED]', error)
  }
}
