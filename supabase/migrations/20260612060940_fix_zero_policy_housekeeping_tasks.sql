-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060940  name: fix_zero_policy_housekeeping_tasks
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "housekeeping_tenant" ON housekeeping_tasks
  FOR ALL USING (tenant_id = current_tenant_id());
