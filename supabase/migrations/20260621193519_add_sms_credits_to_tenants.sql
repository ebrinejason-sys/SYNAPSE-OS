-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260621193519  name: add_sms_credits_to_tenants
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sms_credits integer DEFAULT 0;
