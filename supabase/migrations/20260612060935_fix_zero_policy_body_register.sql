-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060935  name: fix_zero_policy_body_register
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "body_register_tenant" ON body_register
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());
