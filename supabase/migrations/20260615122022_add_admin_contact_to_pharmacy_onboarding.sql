-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260615122022  name: add_admin_contact_to_pharmacy_onboarding
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


ALTER TABLE public.pharmacy_onboarding
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS admin_name  TEXT;
