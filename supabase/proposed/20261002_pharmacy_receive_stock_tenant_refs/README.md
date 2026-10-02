# PROPOSED — receive_pharmacy_stock tenant ownership checks

**Status: applied LOCALLY only. NOT applied to production.**

Migration: `supabase/migrations/20261002120000_pharmacy_receive_stock_tenant_refs.sql`

## Why
`receive_pharmacy_stock` accepted `p_supplier_id`, `p_purchase_order_id` and
`p_store_id` without checking the tenant and wrote them into
`pharmacy_audit_logs.details`. The app routes now check ownership first
(`apps/pharmacy/lib/tenant-refs.ts`); this migration enforces the same rule in the
database so every caller (bulk upload, PO receive, purchases) is covered.

Also: a new batch received with `p_cost_price = null` violated the NOT NULL
`pharmacy_product_batches.cost_price` column (the receive API passes `costPrice ?? null`,
so a receive without cost returned 500). It now falls back to the product cost price.

## Safety
- `CREATE OR REPLACE` with the identical 13-argument signature: grants, overloads and
  callers are unchanged.
- Body = the production definition (prosrc md5 `366814bd594319fac0689ab05338376a`, identical
  locally and in prod on 2026-10-02) plus three `not exists` checks raising
  `SUPPLIER_NOT_FOUND` / `PURCHASE_ORDER_NOT_FOUND` / `STORE_NOT_FOUND`, plus the cost fallback.
- No data changes. Rollback = re-run the previous definition from
  `20260921120000_pharmacy_purchases.sql`.

## Verify (local, rolled back)
`psql ... -f verify.sql` → foreign supplier/PO/store raise `*_NOT_FOUND`; own supplier returns `ok=true`.

## Human action
Apply to production through the normal migration process after review.
