-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260907100539  name: feature_flags_postgrest_conflict_target
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_tenant_key_on_conflict ON public.feature_flags (tenant_id, feature_key);
