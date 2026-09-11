-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612061003  name: fix_zero_policy_visitor_log
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "visitor_log_tenant" ON visitor_log
  FOR ALL USING (tenant_id = current_tenant_id());
