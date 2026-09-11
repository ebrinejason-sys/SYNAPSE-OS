-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260830071642  name: platform_access_governance
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Platform control-plane membership and invitation governance
-- Extends existing profiles/sessions identity — no separate login system.

-- ---------------------------------------------------------------------------
-- platform_memberships
-- ---------------------------------------------------------------------------
create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform_role text not null,
  status text not null default 'INVITED'
    check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  last_access_at timestamptz,
  mfa_required boolean not null default true,
  password_change_required boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_memberships_user_active_uidx
  on public.platform_memberships (user_id)
  where status in ('INVITED', 'ACTIVE', 'SUSPENDED');

create index if not exists platform_memberships_status_idx
  on public.platform_memberships (status, platform_role);

create index if not exists platform_memberships_expires_idx
  on public.platform_memberships (expires_at)
  where expires_at is not null and status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- platform_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  platform_role text not null,
  token_hash text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.platform_memberships(id) on delete set null,
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  resent_count integer not null default 0,
  revoked_at timestamptz,
  notes text,
  visibility_scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_invitations_token_hash_uidx
  on public.platform_invitations (token_hash);

create index if not exists platform_invitations_email_status_idx
  on public.platform_invitations (lower(email), status);

create index if not exists platform_invitations_pending_idx
  on public.platform_invitations (expires_at)
  where status = 'PENDING';

-- ---------------------------------------------------------------------------
-- Bootstrap existing platform_admin profiles into memberships
-- ---------------------------------------------------------------------------
insert into public.platform_memberships (
  user_id,
  platform_role,
  status,
  accepted_at,
  mfa_required,
  invited_at,
  created_at,
  updated_at
)
select
  p.id,
  'PLATFORM_ADMIN',
  'ACTIVE',
  coalesce(p.created_at, now()),
  true,
  coalesce(p.created_at, now()),
  now(),
  now()
from public.profiles p
where p.role = 'platform_admin'
  and not exists (
    select 1 from public.platform_memberships m
    where m.user_id = p.id
      and m.status in ('INVITED', 'ACTIVE', 'SUSPENDED')
  );

-- ---------------------------------------------------------------------------
-- RLS — service role only (platform APIs use supabaseAdmin)
-- ---------------------------------------------------------------------------
alter table public.platform_memberships enable row level security;
alter table public.platform_invitations enable row level security;

drop policy if exists platform_memberships_service on public.platform_memberships;
create policy platform_memberships_service on public.platform_memberships
  for all using (false) with check (false);

drop policy if exists platform_invitations_service on public.platform_invitations;
create policy platform_invitations_service on public.platform_invitations
  for all using (false) with check (false);
