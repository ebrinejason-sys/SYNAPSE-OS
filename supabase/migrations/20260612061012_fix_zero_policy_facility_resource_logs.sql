-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612061012  name: fix_zero_policy_facility_resource_logs
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "facility_resource_tenant" ON facility_resource_logs
  FOR ALL USING (hospital_id = current_tenant_id());
