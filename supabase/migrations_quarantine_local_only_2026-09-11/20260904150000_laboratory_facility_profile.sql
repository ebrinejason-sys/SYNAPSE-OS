ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS laboratory_profile JSONB NOT NULL DEFAULT '{}'::jsonb;