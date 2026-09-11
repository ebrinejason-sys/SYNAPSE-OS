-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612061028  name: fix_zero_policy_sdg_reports
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "sdg_platform_admin" ON sdg_reports
  FOR ALL USING (is_platform_admin());
