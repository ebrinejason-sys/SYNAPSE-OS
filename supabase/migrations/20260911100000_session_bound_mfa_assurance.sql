alter table if exists public.synapse_sessions
  add column if not exists mfa_assured_at timestamptz;

create table if not exists public.mfa_step_up_replays (
  session_id uuid not null references public.synapse_sessions(id) on delete cascade,
  enrollment_id uuid not null references public.mfa_enrollments(id) on delete cascade,
  time_step bigint not null,
  created_at timestamptz not null default now(),
  primary key (session_id, enrollment_id, time_step)
);

alter table public.mfa_step_up_replays enable row level security;