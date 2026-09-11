-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260621193522  name: add_phone_to_profiles
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
