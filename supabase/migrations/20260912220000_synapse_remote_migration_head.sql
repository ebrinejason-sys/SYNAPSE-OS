-- Expose remote migration ledger head to the control plane (service_role only).
-- supabase_migrations is not in PostgREST exposure; this SECURITY DEFINER RPC
-- lets Admin SHA alignment show GitHub/Vercel/process vs applied migration head
-- without inventing green status.

create or replace function public.synapse_remote_migration_head()
returns table(version text, name text)
language sql
stable
security definer
set search_path = supabase_migrations, public
as $$
  select sm.version::text, sm.name
  from supabase_migrations.schema_migrations as sm
  order by sm.version desc
  limit 1;
$$;

revoke all on function public.synapse_remote_migration_head() from public;
revoke all on function public.synapse_remote_migration_head() from anon;
revoke all on function public.synapse_remote_migration_head() from authenticated;
grant execute on function public.synapse_remote_migration_head() to service_role;

comment on function public.synapse_remote_migration_head() is
  'Control-plane only: latest applied supabase_migrations.schema_migrations row.';
