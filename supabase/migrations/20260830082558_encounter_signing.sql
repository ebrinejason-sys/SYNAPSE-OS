-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260830082558  name: encounter_signing
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'encounters_status_check'
  ) THEN
    ALTER TABLE public.encounters
      ADD CONSTRAINT encounters_status_check
      CHECK (status IS NULL OR status IN ('open','in_progress','signed','cancelled','completed'));
  END IF;
END $$;
