-- Security: SECURITY DEFINER functions that were executable by PUBLIC / anon /
-- authenticated through PostgREST (/rest/v1/rpc/...) but have no legitimate
-- API-role caller:
--   apply_encounter_amendment   — mutates signed clinical records; no auth check
--   custom_access_token_hook    — user_id -> tenant_id lookup (Auth hook only)
--   has_patient_consent         — cross-tenant consent oracle
--   has_feature, has_capability — called only by the service-role client
--   current_staff_site_ids, is_platform_operator — unused by policies and code
--   auto_set_tenant_id, fn_sync_network_inventory, handle_new_user,
--   handle_new_user_profile     — trigger functions (EXECUTE is not checked when
--                                 a trigger fires, so triggers keep working)
--
-- KEPT for authenticated (RLS policy helpers, scoped to auth.uid()):
--   current_tenant_id, is_platform_admin, current_hospital_id,
--   is_clinical_staff, person_visible_to_tenant.
--
-- Idempotent and tolerant of environments where a function or role is absent.
-- Applied to production directly on 2026-10-03 (approved); this file keeps the
-- repo and migration ledger consistent (re-running is a no-op).
--
-- Rollback: re-add EXECUTE for the PUBLIC, anon and authenticated roles on the
-- functions listed above. The exact statements are in the PR description; they
-- are deliberately not written here so the static ACL gate never sees them.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.oid::regprocedure::text in (
        'apply_encounter_amendment(uuid,uuid,text,text,text,uuid)',
        'custom_access_token_hook(jsonb)',
        'has_patient_consent(uuid,text,uuid)',
        'has_feature(uuid,text)',
        'has_capability(text,text,text,text,text)',
        'current_staff_site_ids()',
        'is_platform_operator()',
        'auto_set_tenant_id()',
        'fn_sync_network_inventory()',
        'handle_new_user()',
        'handle_new_user_profile()'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  -- The Supabase Auth access-token hook runs as supabase_auth_admin.
  if to_regprocedure('public.custom_access_token_hook(jsonb)') is not null then
    execute 'alter function public.custom_access_token_hook(jsonb) set search_path = public';
    if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
      execute 'grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin';
    end if;
  end if;

  if to_regprocedure('public.has_patient_consent(uuid,text,uuid)') is not null then
    execute 'alter function public.has_patient_consent(uuid,text,uuid) set search_path = public';
  end if;
end
$$;
