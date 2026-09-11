alter table if exists public.synapse_sessions
  add column if not exists mfa_assured_at timestamptz;

-- Global per-code single-use: primary key is (enrollment_id, time_step) only,
-- not session_id, so a captured/leaked TOTP code cannot be redeemed a second
-- time in a *different* session either — session_id is retained as a plain
-- column purely for forensic audit of which session redeemed it.
create table if not exists public.mfa_step_up_replays (
  enrollment_id uuid not null references public.mfa_enrollments(id) on delete cascade,
  time_step bigint not null,
  session_id uuid not null references public.synapse_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (enrollment_id, time_step)
);

create index if not exists mfa_step_up_replays_session_idx
  on public.mfa_step_up_replays (session_id);

alter table public.mfa_step_up_replays enable row level security;

revoke all on table public.mfa_step_up_replays from public, anon, authenticated;
grant select, insert on table public.mfa_step_up_replays to service_role;