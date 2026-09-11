-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260608165417  name: add_password_hash_to_pharmacy_customers
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

ALTER TABLE pharmacy_customers ADD COLUMN IF NOT EXISTS password_hash text;
