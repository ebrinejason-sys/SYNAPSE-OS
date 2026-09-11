-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060922  name: fix_zero_policy_drug_shortage_alerts
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "drug_shortage_read" ON drug_shortage_alerts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "drug_shortage_admin_write" ON drug_shortage_alerts
  FOR ALL USING (is_platform_admin() OR
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hospital_admin'));
