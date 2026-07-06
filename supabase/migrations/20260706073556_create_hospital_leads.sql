create table if not exists public.hospital_leads (
  id uuid primary key default gen_random_uuid(),
  hospital_name text not null,
  facility_type text not null default 'hospital' check (facility_type in ('hospital', 'pharmacy')),
  contact_name text,
  contact_email text,
  contact_phone text,
  location text,
  bed_count integer,
  current_system text,
  departments text[] not null default '{}',
  notes text,
  status text not null default 'new',
  stage text not null default 'interest' check (stage in ('interest', 'demo', 'trial', 'converted', 'lost')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_email)
);

alter table public.hospital_leads enable row level security;

drop policy if exists platform_admin_only on public.hospital_leads;
create policy platform_admin_only on public.hospital_leads for all using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'platform_admin'
  )
);

create index if not exists hospital_leads_created_at_idx on public.hospital_leads (created_at desc);
create index if not exists hospital_leads_status_idx on public.hospital_leads (status);
