-- Pharmacy: atomic credit-ledger postings and till cash accounting.
--
-- Replaces app-side read -> compute -> overwrite with database-level atomic
-- operations:
--   * post_pharmacy_credit_entry: locks the customer row, computes the running
--     balance, rejects overpayment, honours an optional idempotency key and
--     inserts the ledger row in one transaction.
--   * pharmacy_till_cash_events: append-only cash events, unique per source
--     (sale / refund id), so retries and replays can never double-count.
--   * pharmacy_till_record_cash: inserts the event (ON CONFLICT DO NOTHING) and
--     increments the session total with UPDATE ... SET x = x + amount.
--
-- Forward-safe: additive only (nullable column, new table, new functions).
-- Production on 2026-10-02: 0 credit-ledger rows, 1 till session, so the
-- unique index build is instant. Rollback: drop the two functions, the table,
-- the index and the column (no existing data depends on them).

alter table public.pharmacy_credit_ledger
  add column if not exists idempotency_key text;

create unique index if not exists pharmacy_credit_ledger_tenant_idem_uidx
  on public.pharmacy_credit_ledger (tenant_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.pharmacy_till_cash_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.pharmacy_cashier_sessions(id) on delete cascade,
  kind text not null check (kind in ('sale', 'refund', 'cash_in', 'cash_out')),
  amount numeric not null check (amount > 0),
  source_id text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists pharmacy_till_cash_events_source_uidx
  on public.pharmacy_till_cash_events (tenant_id, kind, source_id)
  where source_id is not null;
create index if not exists pharmacy_till_cash_events_session_idx
  on public.pharmacy_till_cash_events (session_id);

-- Service-role only (no client policies => anon/authenticated denied).
alter table public.pharmacy_till_cash_events enable row level security;
revoke all on table public.pharmacy_till_cash_events from anon, authenticated;

create or replace function public.post_pharmacy_credit_entry(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_type text,
  p_amount numeric,
  p_transaction_id uuid default null,
  p_due_date date default null,
  p_notes text default null,
  p_created_by uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_existing pharmacy_credit_ledger%rowtype;
  v_balance numeric;
  v_after numeric;
  v_row pharmacy_credit_ledger%rowtype;
begin
  if p_type not in ('credit', 'repayment') then
    raise exception 'INVALID_TYPE: %', p_type;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: amount must be greater than zero';
  end if;

  -- Serialise every posting for this customer (tenant-scoped).
  perform 1 from pharmacy_customers
    where id = p_customer_id and tenant_id = p_tenant_id
    for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if v_key is not null then
    select * into v_existing from pharmacy_credit_ledger
      where tenant_id = p_tenant_id and idempotency_key = v_key;
    if found then
      return to_jsonb(v_existing) || jsonb_build_object('replayed', true);
    end if;
  end if;

  select balance_after into v_balance from pharmacy_credit_ledger
    where tenant_id = p_tenant_id and customer_id = p_customer_id
    order by created_at desc, id desc
    limit 1;
  v_balance := coalesce(v_balance, 0);

  if p_type = 'repayment' and p_amount > v_balance then
    raise exception 'OVERPAYMENT: repayment % exceeds outstanding balance %', p_amount, v_balance;
  end if;
  v_after := case when p_type = 'credit' then v_balance + p_amount else v_balance - p_amount end;

  insert into pharmacy_credit_ledger
    (tenant_id, customer_id, transaction_id, amount, type, balance_after,
     due_date, notes, created_by, created_at, idempotency_key)
  values
    (p_tenant_id, p_customer_id, p_transaction_id, p_amount, p_type, v_after,
     p_due_date, p_notes, p_created_by, clock_timestamp(), v_key)
  returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('replayed', false);
end;
$function$;

create or replace function public.pharmacy_till_record_cash(
  p_tenant_id uuid,
  p_session_id uuid,
  p_kind text,
  p_amount numeric,
  p_source_id text default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event_id uuid;
  v_session pharmacy_cashier_sessions%rowtype;
begin
  if p_kind not in ('sale', 'refund', 'cash_in', 'cash_out') then
    raise exception 'INVALID_KIND: %', p_kind;
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('applied', false, 'reason', 'NO_CASH');
  end if;

  insert into pharmacy_till_cash_events (tenant_id, session_id, kind, amount, source_id, created_by)
  values (p_tenant_id, p_session_id, p_kind, p_amount, nullif(trim(coalesce(p_source_id, '')), ''), p_actor_id)
  on conflict (tenant_id, kind, source_id) where source_id is not null do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('applied', false, 'reason', 'DUPLICATE');
  end if;

  update pharmacy_cashier_sessions
  set cash_payment_total = coalesce(cash_payment_total, 0) + case when p_kind = 'sale' then p_amount else 0 end,
      cash_refund_total  = coalesce(cash_refund_total, 0)  + case when p_kind = 'refund' then p_amount else 0 end,
      cash_in            = coalesce(cash_in, 0)            + case when p_kind = 'cash_in' then p_amount else 0 end,
      cash_out           = coalesce(cash_out, 0)           + case when p_kind = 'cash_out' then p_amount else 0 end
  where id = p_session_id and tenant_id = p_tenant_id
  returning * into v_session;

  if not found then
    raise exception 'TILL_NOT_FOUND';
  end if;

  return jsonb_build_object('applied', true, 'event_id', v_event_id, 'session', to_jsonb(v_session));
end;
$function$;

revoke all on function public.post_pharmacy_credit_entry(uuid, uuid, text, numeric, uuid, date, text, uuid, text) from public, anon, authenticated;
grant execute on function public.post_pharmacy_credit_entry(uuid, uuid, text, numeric, uuid, date, text, uuid, text) to service_role;
revoke all on function public.pharmacy_till_record_cash(uuid, uuid, text, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.pharmacy_till_record_cash(uuid, uuid, text, numeric, text, uuid) to service_role;
