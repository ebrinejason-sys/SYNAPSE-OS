import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard (release acceptance round 2, D2).
 *
 * These tables' `created_by` column is a legacy FK to auth.users(id). SYNAPSE
 * staff authenticate against public.profiles, whose ids are NOT auth.users ids,
 * so writing a staff id into created_by fails with 23503 (e.g. patient
 * registration returned 500 "violates foreign key constraint
 * patients_created_by_fkey"). Record the actor in audit_log.user_id or a
 * profiles-FK column (e.g. encounter_diagnoses.selected_by) instead.
 * List generated from the schema (FKs public.*.created_by -> auth.users).
 */
const AUTH_USERS_FK_CREATED_BY = new Set<string>(['aefi_reports', 'allergens_catalog', 'audit_log', 'bed_assignments', 'beta_access_requests', 'billing_invoices', 'billing_line_items', 'care_team_handovers', 'cds_alerts', 'cds_rules', 'chw_visits', 'claim_line_items', 'claim_resubmissions', 'community_health_workers', 'consent_audit_log', 'data_breach_incidents', 'data_export_jobs', 'data_retention_policies', 'death_registrations', 'death_reports', 'denial_analytics_daily', 'departments', 'device_alerts', 'device_readings', 'diagnoses', 'drug_contraindications', 'drug_dose_adjustments', 'drug_interactions', 'drug_interactions_catalog', 'encounter_diagnoses', 'encounter_orders', 'encounters', 'expert_rules', 'gas_cylinders', 'handover_patient_entries', 'handover_shift_tasks', 'handover_signatures', 'hospital_beds', 'hospital_drug_orders', 'hospital_settings', 'imaging_series', 'immunization_schedule', 'import_batch_rows', 'import_column_mappings', 'insurance_claims', 'inventory_items', 'lab_results', 'loinc_reference', 'maternity_records', 'medical_devices', 'medication_safety_checks', 'nin_access_log', 'notifications', 'order_items', 'order_mappings', 'orders', 'passport_share_tokens', 'pathway_alerts', 'pathway_checklist_items', 'patient_access_grants', 'patient_allergies', 'patient_billing', 'patient_consents', 'patient_notes', 'patient_pathways', 'patient_safety_events', 'patient_sms_reminders', 'patient_timeline_pins', 'patients', 'payer_contracts', 'pediatric_growth_records', 'pharmacy_stores', 'phi_access_log', 'products', 'profiles', 'provider_verification_checks', 'purchase_orders', 'radiology_reports', 'referral_requests', 'renal_adjustments_catalog', 'restaurants', 'rule_executions', 'scan_events', 'sentinel_alerts', 'service_catalog', 'staff_attendance', 'staff_leave_requests', 'suppliers', 'surgery_schedules', 'sync_conflicts', 'sync_idempotency_keys', 'telemedicine_followups', 'telemedicine_frontdesk_queue', 'telemedicine_intake_cases', 'telemedicine_intake_messages', 'telemedicine_providers', 'telemedicine_session_events', 'telemedicine_staff_alerts', 'telemedicine_voice_memos', 'tenant_domains', 'tenant_logging_policies', 'tenant_provisioning_jobs', 'ucg_guidelines', 'verification_documents', 'vitals'])

const ROOTS = ['apps/web/src/app/api', 'apps/web/src/lib']
const repoRoot = join(__dirname, '../../../../..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe('created_by writes never target auth.users-FK columns', () => {
  it('no insert/upsert/update into an auth.users-FK table sets created_by', () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(join(repoRoot, root))) {
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (!/^\s*created_by\s*:/.test(line)) return
          if (/^\s*created_by\s*:\s*(string|number|null|undefined)\b[^,]*[;|]/.test(line)) return // type annotation
          const fromOn = (k: number) => [...lines[k]!.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)].pop()?.[1]
          let table: string | undefined
          for (let j = i; j >= Math.max(0, i - 40) && !table; j--) table = fromOn(j)
          // Row objects built before the query: look ahead for the insert/upsert.
          for (let j = i + 1; j < Math.min(lines.length, i + 30) && !table; j++) table = fromOn(j)
          if (table && AUTH_USERS_FK_CREATED_BY.has(table)) offenders.push(`${relative(repoRoot, file)}:${i + 1} -> ${table}`)
        })
      }
    }
    expect(offenders).toEqual([])
  })
})
