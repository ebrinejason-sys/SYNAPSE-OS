-- Read-only verification after applying 20261002140000.
select to_regclass('public.pharmacy_till_cash_events') is not null as till_events_table;
select exists(select 1 from information_schema.columns where table_schema='public'
  and table_name='pharmacy_credit_ledger' and column_name='idempotency_key') as credit_idem_col;
select proname, prosecdef, has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and proname in ('post_pharmacy_credit_entry','pharmacy_till_record_cash');
select relrowsecurity from pg_class where oid='public.pharmacy_till_cash_events'::regclass;
-- Invariant: for sessions with events, cash totals == sum of committed events (expect 0 rows).
select s.id from public.pharmacy_cashier_sessions s
  join (select session_id,
               sum(amount) filter (where kind='sale') sales,
               sum(amount) filter (where kind='refund') refunds
          from public.pharmacy_till_cash_events group by session_id) e on e.session_id = s.id
 where s.opened_at >= (select min(created_at) from public.pharmacy_till_cash_events)
   and (coalesce(e.sales,0) <> coalesce(s.cash_payment_total,0)
        or coalesce(e.refunds,0) <> coalesce(s.cash_refund_total,0));
