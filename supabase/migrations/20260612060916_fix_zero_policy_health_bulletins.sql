-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612060916  name: fix_zero_policy_health_bulletins
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "health_bulletins_auth_read" ON health_bulletins
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "health_bulletins_admin_write" ON health_bulletins
  FOR ALL USING (is_platform_admin());
