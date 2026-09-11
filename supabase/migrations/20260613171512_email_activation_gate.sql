-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260613171512  name: email_activation_gate
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

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
