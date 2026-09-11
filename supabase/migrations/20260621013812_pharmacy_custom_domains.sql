-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260621013812  name: pharmacy_custom_domains
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Dedicated pharmacy custom-domain -> tenant mapping.
-- The generic public.tenant_domains table is hospital-scoped (NOT NULL hospital_id, tenant_key),
-- so a separate table keeps the pharmacy concern isolated and supports verified + is_primary + multi-domain.
create table if not exists public.pharmacy_custom_domains (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  domain      text not null,
  is_primary  boolean not null default false,
  verified    boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Domains are case-insensitive and globally unique (one domain -> one tenant).
create unique index if not exists pharmacy_custom_domains_domain_key
  on public.pharmacy_custom_domains (lower(domain));

-- At most one primary domain per tenant.
create unique index if not exists pharmacy_custom_domains_one_primary
  on public.pharmacy_custom_domains (tenant_id)
  where is_primary;

create index if not exists pharmacy_custom_domains_tenant_idx
  on public.pharmacy_custom_domains (tenant_id);

alter table public.pharmacy_custom_domains enable row level security;

-- Platform admins manage everything.
drop policy if exists pharmacy_custom_domains_platform_admin on public.pharmacy_custom_domains;
create policy pharmacy_custom_domains_platform_admin
  on public.pharmacy_custom_domains
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Tenant members may READ their own tenant's domains (no write).
drop policy if exists pharmacy_custom_domains_tenant_read on public.pharmacy_custom_domains;
create policy pharmacy_custom_domains_tenant_read
  on public.pharmacy_custom_domains
  for select
  to authenticated
  using (tenant_id = (select p.tenant_id from public.profiles p where p.id = auth.uid()));

comment on table public.pharmacy_custom_domains is 'Maps a pharmacy tenant''s custom domain(s) to its tenant_id. Service role (server) manages writes; platform admins manage via RLS; tenant members read-only. Resolution is performed server-side via the service role in the pharmacy app.';
