-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260607100048  name: create_professional_leads
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.


create table if not exists public.professional_leads (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null unique,
  phone           text,
  role            text not null,
  specialty       text,
  license_number  text,
  hospital_name   text,
  location        text,
  hospital_type   text,
  bed_count       integer,
  current_system  text,
  interests       text[] not null default '{}',
  message         text,
  hear_about_us   text,
  status          text not null default 'new',
  source          text not null default 'apply_professional',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- keep updated_at current on any row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists professional_leads_updated_at on public.professional_leads;
create trigger professional_leads_updated_at
  before update on public.professional_leads
  for each row execute function public.set_updated_at();

-- RLS: enable but allow unauthenticated inserts (public lead-capture form)
alter table public.professional_leads enable row level security;

drop policy if exists "anyone can submit a lead" on public.professional_leads;
create policy "anyone can submit a lead"
  on public.professional_leads for insert
  to anon, authenticated
  with check (true);

-- founders (service role) can read all leads
drop policy if exists "service role reads all" on public.professional_leads;
create policy "service role reads all"
  on public.professional_leads for select
  using (auth.role() = 'authenticated');
