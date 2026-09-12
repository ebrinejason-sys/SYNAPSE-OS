-- Extra lifecycle columns for facility_referrals (RC1 referrals domain).

ALTER TABLE public.facility_referrals
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_facility_referrals_from_tenant
  ON public.facility_referrals (from_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facility_referrals_to_tenant
  ON public.facility_referrals (to_tenant_id, created_at DESC);
