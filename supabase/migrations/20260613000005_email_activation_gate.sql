ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_email_verified_at_idx
  ON public.profiles (email_verified_at)
  WHERE email IS NOT NULL;

COMMENT ON COLUMN public.profiles.email_verified_at IS
  'Set after the user follows the custom Synapse OS email activation link.';

COMMENT ON COLUMN public.profiles.activation_sent_at IS
  'Timestamp for the latest outbound activation email.';
