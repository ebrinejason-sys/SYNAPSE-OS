-- Distributed (Postgres-backed) rate limiter shared by every app instance.
--
-- Replaces per-instance in-memory counters (which reset on every serverless cold
-- start and are not shared across instances) for abuse-sensitive auth endpoints
-- (first user: Pharmacy self-serve signup; next: supervisor approval).
--
-- Privacy: bucket_key is an HMAC-SHA256 (computed in the app with a server-side
-- pepper) of "<scope>|<identifier>". Raw IPs / emails are never stored.
--
-- Forward-safe: new table + new function only. Rollback:
--   drop function public.consume_auth_rate_limit(text, integer, integer);
--   drop function public.auth_rate_limit_status(text, integer, integer);
--   drop function public.reset_auth_rate_limit(text);
--   drop table public.auth_rate_limit_buckets;

create table if not exists public.auth_rate_limit_buckets (
  bucket_key   text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null default now(),
  hits         integer not null default 0,
  updated_at   timestamptz not null default now()
);

create index if not exists auth_rate_limit_buckets_window_idx
  on public.auth_rate_limit_buckets (window_start);

alter table public.auth_rate_limit_buckets enable row level security;
revoke all on table public.auth_rate_limit_buckets from anon, authenticated;

-- Atomic fixed-window counter: one INSERT ... ON CONFLICT DO UPDATE statement, so
-- concurrent callers on any instance serialize on the row and never lose a hit.
create or replace function public.consume_auth_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hits integer;
  v_start timestamptz;
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
begin
  if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_BUCKET_KEY';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'INVALID_LIMIT';
  end if;

  insert into auth_rate_limit_buckets as b (bucket_key, window_start, hits, updated_at)
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
     set window_start = case when b.window_start <= v_now - v_window then v_now else b.window_start end,
         hits         = case when b.window_start <= v_now - v_window then 1 else b.hits + 1 end,
         updated_at   = v_now
  returning hits, window_start into v_hits, v_start;

  -- Opportunistic retention: drop buckets idle for a day (~1% of calls).
  if random() < 0.01 then
    delete from auth_rate_limit_buckets where updated_at < v_now - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'hits', v_hits,
    'retry_after', greatest(ceil(extract(epoch from (v_start + v_window - v_now)))::int, 1)
  );
end;
$function$;

revoke all on function public.consume_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer, integer) to service_role;

-- Read-only status (no increment) for lockout checks, and an explicit reset used
-- when a guarded action succeeds (e.g. supervisor approval resets its failure count).
create or replace function public.auth_rate_limit_status(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select jsonb_build_object(
              'allowed', not (b.hits >= p_limit and b.window_start > clock_timestamp() - make_interval(secs => greatest(p_window_seconds, 1))),
              'hits', case when b.window_start > clock_timestamp() - make_interval(secs => greatest(p_window_seconds, 1)) then b.hits else 0 end,
              'retry_after', greatest(ceil(extract(epoch from (b.window_start + make_interval(secs => greatest(p_window_seconds, 1)) - clock_timestamp())))::int, 1))
       from auth_rate_limit_buckets b where b.bucket_key = p_bucket_key),
    jsonb_build_object('allowed', true, 'hits', 0, 'retry_after', 0));
$function$;

create or replace function public.reset_auth_rate_limit(p_bucket_key text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  delete from auth_rate_limit_buckets where bucket_key = p_bucket_key;
$function$;

revoke all on function public.auth_rate_limit_status(text, integer, integer) from public, anon, authenticated;
grant execute on function public.auth_rate_limit_status(text, integer, integer) to service_role;
revoke all on function public.reset_auth_rate_limit(text) from public, anon, authenticated;
grant execute on function public.reset_auth_rate_limit(text) to service_role;
