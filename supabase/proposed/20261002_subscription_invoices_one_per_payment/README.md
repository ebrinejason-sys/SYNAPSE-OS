# 20261002170000 — one subscription invoice per payment

Migration: `supabase/migrations/20261002170000_subscription_invoices_one_per_payment.sql`
(unique index `subscription_invoices_payment_id_uidx` on `subscription_invoices(payment_id)`).

Why: a duplicate Flutterwave webhook racing the redirect verify could mint two invoices
for one payment. App code (50911a0) returns early on an idempotent activation and treats a
23505 on the invoice insert as "the other request won"; the index makes it a DB guarantee.

Prod precheck (read-only, 2026-10-02): 1 invoice, 0 duplicate payment_id groups.
The table is tiny, so the non-concurrent index build holds its lock for milliseconds.

Verify after apply:

```sql
select count(*) from (select payment_id from subscription_invoices
  where payment_id is not null group by 1 having count(*) > 1) d;  -- expect 0
select indexdef from pg_indexes where indexname = 'subscription_invoices_payment_id_uidx';
```

Rollback: `drop index if exists public.subscription_invoices_payment_id_uidx;`
(app code stays correct without it; only the DB backstop is lost).
