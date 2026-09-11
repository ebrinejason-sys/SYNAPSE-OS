-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060902  name: fix_zero_policy_mfa_enrollments
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "mfa_own_all" ON mfa_enrollments
  FOR ALL USING (user_id = auth.uid());
