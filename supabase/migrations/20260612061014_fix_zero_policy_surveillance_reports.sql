-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612061014  name: fix_zero_policy_surveillance_reports
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "surveillance_read" ON surveillance_reports
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_platform_admin());
CREATE POLICY "surveillance_insert" ON surveillance_reports
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
