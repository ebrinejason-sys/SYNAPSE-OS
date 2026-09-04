-- The shared updated-at trigger requires this column on hospitals.
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();