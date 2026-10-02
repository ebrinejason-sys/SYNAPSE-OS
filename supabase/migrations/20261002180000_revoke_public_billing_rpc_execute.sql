-- Security: the subscription state-machine RPCs are SECURITY DEFINER and were
-- executable by anon / authenticated / PUBLIC through PostgREST
-- (/rest/v1/rpc/...). Every application caller uses the service-role client
-- (billing-sweep cron, Flutterwave webhook confirm, manual activation, platform
-- audit). Internal chains (activate -> log_event, advance_all -> advance_state
-- -> log_event) run as the definer (postgres) and are unaffected.
--
-- Idempotent. Applied to production directly on 2026-10-02 (approved); this file
-- keeps the repo and migration ledger consistent (re-running is a no-op).
--
-- Rollback (restores the previous, insecure grants):
--   grant execute on function public.activate_subscription_payment(uuid, text) to anon, authenticated, public;
--   grant execute on function public.advance_all_subscriptions(text) to anon, authenticated, public;
--   grant execute on function public.advance_subscription_state(uuid, text) to anon, authenticated, public;
--   grant execute on function public.log_subscription_event(uuid, text, text, text, text, jsonb) to anon, authenticated, public;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'activate_subscription_payment',
        'advance_all_subscriptions',
        'advance_subscription_state',
        'log_subscription_event'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
