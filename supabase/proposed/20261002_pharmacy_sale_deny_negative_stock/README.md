# Deny negative stock on sale — migration 20261002130000 (NOT applied to production)

Product decision (2026-10-02): normal POS / dispense sales must never take stock negative.

- Migration: `supabase/migrations/20261002130000_pharmacy_sale_deny_negative_stock.sql`
- Change: 12-argument `complete_pharmacy_sale` raises `INSUFFICIENT_STOCK` instead of drawing a
  `NEG-STOCK` overdraft batch. Same signature, so grants and callers are unchanged. The 11-argument
  overload already raised `INSUFFICIENT_STOCK`.
- No legitimate workflow needs the overdraft: production had 0 `NEG-STOCK` batches and 0 products
  below zero on 2026-10-02 (read-only SELECT). Physical counts (`set_pharmacy_physical_stock`) are a
  separate admin path and are unchanged.
- Concurrency: the RPC already serialises per tenant (`pg_advisory_xact_lock`) and locks the product
  row `FOR UPDATE`, so two cashiers racing for the last unit get exactly one success; the other gets
  `INSUFFICIENT_STOCK` (HTTP 409). Proven by `scripts/db-tests/pharmacy-concurrency.local.test.mjs`.
- Locks: catalog-only (CREATE OR REPLACE FUNCTION). No table rewrite.
- Rollback: re-apply the definition from `20260924120000_pharmacy_physical_stock_negative.sql`.
- Verify after apply: `verify.sql` in this folder.
