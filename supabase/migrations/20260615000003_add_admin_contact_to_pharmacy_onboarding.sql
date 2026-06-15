-- Store the intended admin email + name alongside the invite token so the
-- invite redemption flow can create a profile even if the initial insert failed.
ALTER TABLE public.pharmacy_onboarding
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS admin_name  TEXT;
