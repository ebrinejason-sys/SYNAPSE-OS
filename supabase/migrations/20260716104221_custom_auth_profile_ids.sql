-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260716104221  name: custom_auth_profile_ids
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Custom auth owns Synapse user IDs.
-- These rows are no longer required to have matching Supabase Auth users.

ALTER TABLE public.patient_profiles
  DROP CONSTRAINT IF EXISTS patient_profiles_id_fkey;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

COMMENT ON TABLE public.profiles IS
  'Application user profiles. IDs are owned by Synapse custom auth; rows are not required to exist in auth.users.';

COMMENT ON TABLE public.patient_profiles IS
  'Patient-facing profile records. IDs are owned by Synapse custom auth; rows are not required to exist in auth.users.';
