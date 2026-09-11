-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260607111937  name: custom_otp_and_newsletter
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Custom OTP table for phone/email OTP flows (no Supabase phone auth dependency)
CREATE TABLE IF NOT EXISTS public.auth_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel     text NOT NULL CHECK (channel IN ('phone', 'email')),
  target      text NOT NULL,
  otp_hash    text NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used        boolean NOT NULL DEFAULT false,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_otps_lookup
  ON public.auth_otps(target, channel, used, expires_at);
CREATE INDEX IF NOT EXISTS auth_otps_rate_limit
  ON public.auth_otps(target, channel, created_at);
ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  source           text,
  subscribed       boolean NOT NULL DEFAULT true,
  subscribed_at    timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
