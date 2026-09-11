-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260604163130  name: add_tenant_performance_indexes
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE INDEX IF NOT EXISTS idx_encounters_tenant_id ON encounters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_id ON patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vitals_tenant_id ON vitals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_tenant_id ON insurance_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_tenant ON notifications(user_id, tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_hospital_status ON import_batches(hospital_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch_status ON import_batch_rows(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_tenant_patient ON encounters(tenant_id, patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_tenant_clinician ON encounters(tenant_id, clinician_id, visit_date DESC);
