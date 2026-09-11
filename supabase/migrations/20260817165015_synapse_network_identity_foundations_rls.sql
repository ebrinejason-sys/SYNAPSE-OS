-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260817165015  name: synapse_network_identity_foundations_rls
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

create or replace function public.person_visible_to_tenant(p_person_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.person_identifiers i
    where i.person_id = p_person_id
      and i.issuing_facility_id = p_tenant_id
      and i.status = 'active'
  ) or exists (
    select 1 from public.patients p
    where p.person_id = p_person_id and p.tenant_id = p_tenant_id
  ) or exists (
    select 1 from public.pharmacy_customers c
    where c.person_id = p_person_id and c.tenant_id = p_tenant_id
  );
$fn$;

revoke all on function public.person_visible_to_tenant(uuid, uuid) from public, anon;
grant execute on function public.person_visible_to_tenant(uuid, uuid) to authenticated, service_role;

create or replace function public.current_staff_site_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(array_agg(site_id) filter (where site_id is not null), '{}'::uuid[])
  from public.staff_scope_assignments
  where profile_id = auth.uid() and is_active;
$fn$;

do $$
declare
  t text;
  tbls text[] := array[
    'organizations','persons','person_identifiers','person_contacts','person_clinical_facts',
    'person_relationships','emergency_profiles','emergency_access_events',
    'identity_match_candidates','identity_merge_events','person_consents','person_consent_events',
    'insurance_memberships','blood_donation_profiles','blood_donations','blood_deferrals',
    'staff_scope_assignments','pharmacy_stock_transfers','pharmacy_stock_transfer_items',
    'interop_connections','interop_messages','lab_specimens','lab_analyzer_messages',
    'offline_mutation_outbox','platform_audit_events'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare
  t text;
  tenant_tbls text[] := array[
    'interop_connections','interop_messages','lab_specimens','lab_analyzer_messages',
    'offline_mutation_outbox','pharmacy_stock_transfers','platform_audit_events'
  ];
begin
  foreach t in array tenant_tbls loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = t || '_tenant_isolation'
    ) then
      execute format(
        'create policy %I on public.%I for all using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin())',
        t || '_tenant_isolation', t
      );
    end if;
  end loop;
end $$;

drop policy if exists staff_scope_assignments_self_or_admin on public.staff_scope_assignments;
create policy staff_scope_assignments_self_or_admin on public.staff_scope_assignments
  for all
  using (
    is_platform_admin()
    or profile_id = auth.uid()
    or tenant_id = current_tenant_id()
  )
  with check (
    is_platform_admin()
    or tenant_id = current_tenant_id()
  );

drop policy if exists persons_visible on public.persons;
create policy persons_visible on public.persons
  for select
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(id, current_tenant_id())
  );

drop policy if exists persons_write_tenant on public.persons;
create policy persons_write_tenant on public.persons
  for insert
  with check (is_platform_admin() or current_tenant_id() is not null);

drop policy if exists persons_update_visible on public.persons;
create policy persons_update_visible on public.persons
  for update
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(id, current_tenant_id())
  );

drop policy if exists person_identifiers_visible on public.person_identifiers;
create policy person_identifiers_visible on public.person_identifiers
  for all
  using (
    is_platform_admin()
    or issuing_facility_id = current_tenant_id()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or issuing_facility_id = current_tenant_id()
    or issuing_facility_id is null
  );

drop policy if exists person_clinical_facts_visible on public.person_clinical_facts;
create policy person_clinical_facts_visible on public.person_clinical_facts
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
    or source_facility_id = current_tenant_id()
  );

drop policy if exists person_contacts_visible on public.person_contacts;
create policy person_contacts_visible on public.person_contacts
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists person_consents_visible on public.person_consents;
create policy person_consents_visible on public.person_consents
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists insurance_memberships_visible on public.insurance_memberships;
create policy insurance_memberships_visible on public.insurance_memberships
  for all
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  )
  with check (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists emergency_profiles_visible on public.emergency_profiles;
create policy emergency_profiles_visible on public.emergency_profiles
  for select
  using (
    is_platform_admin()
    or public.person_visible_to_tenant(person_id, current_tenant_id())
  );

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select
  using (
    is_platform_admin()
    or exists (
      select 1 from public.tenants t
      where t.organization_id = organizations.id
        and t.id = current_tenant_id()
    )
  );

drop policy if exists pharmacy_stock_transfer_items_via_parent on public.pharmacy_stock_transfer_items;
create policy pharmacy_stock_transfer_items_via_parent on public.pharmacy_stock_transfer_items
  for all
  using (
    is_platform_admin()
    or exists (
      select 1 from public.pharmacy_stock_transfers tr
      where tr.id = transfer_id and tr.tenant_id = current_tenant_id()
    )
  )
  with check (
    is_platform_admin()
    or exists (
      select 1 from public.pharmacy_stock_transfers tr
      where tr.id = transfer_id and tr.tenant_id = current_tenant_id()
    )
  );

revoke all on function public.generate_synapse_id(text) from public, anon;
grant execute on function public.generate_synapse_id(text) to authenticated, service_role;
