-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260810093859  name: pharmacy_rpc_revoke_client_execute
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'complete_pharmacy_sale',
        'receive_pharmacy_stock',
        'adjust_pharmacy_batch_stock',
        'adjust_pharmacy_stock',
        'recompute_pharmacy_product_quantity',
        'reverse_pharmacy_sale',
        'report_unbatched_positive_stock'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('revoke all on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

select p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in ('adjust_pharmacy_batch_stock','adjust_pharmacy_stock','receive_pharmacy_stock','reverse_pharmacy_sale');
