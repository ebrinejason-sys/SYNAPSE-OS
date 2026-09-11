-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260605194256  name: enable_rls_on_8_exposed_tables
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


-- ============================================================
-- Enable RLS on 8 tables that have policies but RLS is OFF
-- Policies already exist — just flipping the switch
-- ============================================================

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apk_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_feed_sessions ENABLE ROW LEVEL SECURITY;
