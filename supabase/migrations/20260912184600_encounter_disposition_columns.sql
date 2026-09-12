-- Encounter disposition columns for Hospital Pilot RC1 closeout.
-- Safe to re-run; aligns live disposition API with durable columns.

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS disposition_reason text,
  ADD COLUMN IF NOT EXISTS disposition_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS disposition_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'encounters_disposition_check'
  ) THEN
    ALTER TABLE public.encounters
      ADD CONSTRAINT encounters_disposition_check
      CHECK (
        disposition IS NULL OR disposition IN (
          'LOCAL_PHARMACY',
          'EXTERNAL_PHARMACY',
          'NO_MEDICATION',
          'FURTHER_LAB',
          'REFERRAL',
          'FOLLOW_UP',
          'CLINICAL_COMPLETE'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.encounters.disposition IS 'Doctor disposition recorded before encounter close (RC1 closeout).';
