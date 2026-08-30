-- Encounter signing + status columns for clinical immutability (P0-002)

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

COMMENT ON COLUMN public.encounters.is_signed IS
  'When true, clinical content must not be silently overwritten; use amendment trail.';
