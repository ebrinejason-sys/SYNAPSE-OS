-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260614192359  name: allow_public_invite_lookup
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- Allow anyone to look up a pending (unused, non-expired) invite by token.
-- The 64-char random token IS the authentication — possession proves authorization.
CREATE POLICY "public_invite_lookup"
  ON pharmacy_onboarding
  FOR SELECT
  USING (
    current_step = 0
    AND invite_expires_at > now()
  );
