-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611154006  name: pharmacy_onboarding_rls_and_printer_type
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- 1. Allow pharmacy users to UPDATE their own onboarding record
CREATE POLICY pharmacy_user_update_onboarding ON pharmacy_onboarding
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL
    )
  );

-- 2. Add printer_type column to pharmacy_settings
ALTER TABLE pharmacy_settings
  ADD COLUMN IF NOT EXISTS printer_type TEXT NOT NULL DEFAULT 'default';
