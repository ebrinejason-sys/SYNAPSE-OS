-- PostgREST cannot infer an ON CONFLICT target from the tenant-scoped
-- partial index. A full unique index preserves the same tenant guarantee
-- while allowing facility provisioning to upsert by (tenant_id, feature_key).
-- The existing partial global index continues to enforce one row per global
-- feature key when tenant_id is null.
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_tenant_key_on_conflict
  ON public.feature_flags (tenant_id, feature_key);
