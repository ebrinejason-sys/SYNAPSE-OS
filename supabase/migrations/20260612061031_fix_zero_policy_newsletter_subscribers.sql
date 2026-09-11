-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260612061031  name: fix_zero_policy_newsletter_subscribers
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE POLICY "newsletter_public_insert" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter_admin_read" ON newsletter_subscribers
  FOR SELECT USING (is_platform_admin());
