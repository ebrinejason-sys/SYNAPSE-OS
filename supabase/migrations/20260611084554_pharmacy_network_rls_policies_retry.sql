-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260611084554  name: pharmacy_network_rls_policies_retry
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pharmacy_profiles' and policyname = 'platform_admin_pharmacy_profiles') then
    create policy platform_admin_pharmacy_profiles on public.pharmacy_profiles
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pharmacy_profiles' and policyname = 'tenant_pharmacy_profiles') then
    create policy tenant_pharmacy_profiles on public.pharmacy_profiles
      using (tenant_id = (select tenant_id from public.profiles where profiles.id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pharmacy_network_inventory' and policyname = 'platform_admin_pharmacy_inventory') then
    create policy platform_admin_pharmacy_inventory on public.pharmacy_network_inventory
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pharmacy_network_inventory' and policyname = 'tenant_pharmacy_inventory') then
    create policy tenant_pharmacy_inventory on public.pharmacy_network_inventory
      using (pharmacy_tenant_id = (select tenant_id from public.profiles where profiles.id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pharmacy_orders' and policyname = 'tenant_pharmacy_orders') then
    create policy tenant_pharmacy_orders on public.pharmacy_orders
      using (tenant_id = (select tenant_id from public.profiles where profiles.id = auth.uid()) or patient_id = auth.uid());
  end if;
end $$;
