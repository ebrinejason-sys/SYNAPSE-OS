-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060857  name: fix_zero_policy_auth_otps
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "auth_otps_own_read" ON auth_otps
  FOR SELECT USING (target = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1));
