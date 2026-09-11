-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260827231440  name: synapse_exchange_rls
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

do $$
declare
  t text;
  tables text[] := array[
    'synapse_domain_events',
    'lab_result_amendments',
    'lab_critical_acknowledgements',
    'lab_reference_ranges',
    'pathway_overrides',
    'clinical_prescriptions',
    'synapse_simulation_runs',
    'platform_incidents',
    'platform_health_checks',
    'platform_module_matrix'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
  end loop;
end $$;

do $$
declare
  t text;
  tenant_tables text[] := array[
    'synapse_domain_events',
    'lab_result_amendments',
    'lab_critical_acknowledgements',
    'pathway_overrides',
    'clinical_prescriptions',
    'synapse_simulation_runs',
    'platform_module_matrix'
  ];
begin
  if to_regprocedure('public.current_tenant_id()') is null
     or to_regprocedure('public.is_platform_admin()') is null then
    return;
  end if;
  foreach t in array tenant_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;
