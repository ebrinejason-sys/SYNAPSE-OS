# Proposed: atomic credit ledger + till cash events (20261002140000)

**Status: applied to LOCAL Supabase only. NOT applied to production.**

## Why
- `pharmacy_credit_ledger` balances were computed in the app (read latest `balance_after`
  → add/subtract → insert). Two concurrent sales/repayments for the same customer could
  both read the same balance and write a broken running balance or a double repayment.
- Till cash (`pharmacy_cashier_sessions.cash_payment_total` etc.) was read → summed → overwritten,
  so concurrent sales lost cash, and retries could double-count.

## What
- `pharmacy_credit_ledger.idempotency_key` (nullable) + unique partial index
  `(tenant_id, idempotency_key)`.
- `pharmacy_till_cash_events` (append-only; unique `(tenant_id, kind, source_id)`), RLS on,
  no anon/authenticated grants.
- `post_pharmacy_credit_entry(...)`: locks the customer row `FOR UPDATE`, computes the
  balance, rejects `OVERPAYMENT`, replays an already-used idempotency key.
- `pharmacy_till_record_cash(...)`: inserts the cash event once, then
  `UPDATE ... SET x = x + amount` on the session row (row-locked by the UPDATE).
- Both functions: `SECURITY DEFINER`, `search_path` pinned, `service_role` execute only.

## Prod compatibility (read-only checks, 2 Oct 2026)
- `pharmacy_credit_ledger`: 0 rows. `pharmacy_cashier_sessions`: 1 row.
- Column / table / functions do not yet exist in prod. Purely additive → no rewrite, the
  unique index build on an empty table is instant; no long locks.

## Deploy order
1. Apply this migration.
2. Deploy the app (the code calls the RPCs; without the migration credit/till posting fails).

## Rollback
```sql
drop function if exists public.pharmacy_till_record_cash(uuid, uuid, text, numeric, text, uuid);
drop function if exists public.post_pharmacy_credit_entry(uuid, uuid, text, numeric, uuid, date, text, uuid, text);
drop table if exists public.pharmacy_till_cash_events;
drop index if exists public.pharmacy_credit_ledger_tenant_idem_uidx;
alter table public.pharmacy_credit_ledger drop column if exists idempotency_key;
```
(Requires redeploying the previous app build first.)

## Tests
`npm run test:pharmacy-concurrency` (local Postgres, real concurrency).
