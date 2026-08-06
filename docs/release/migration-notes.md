# Migration Notes

## 20260805130000_pharmacy_inventory_authority.sql (Phase 1)
**Type:** additive, reversible. **Applies to:** live DB (core pharmacy tables are live-only).

**Changes**
- `pharmacy_product_batches`: `ADD COLUMN IF NOT EXISTS status` (`active|quarantined|damaged|recalled|expired`,
  default `active`) + `manufacturer`, `quarantine_reason`, `recalled_at`, `damaged_reason`;
  status CHECK added once (guarded); legacy `is_active = false` rows backfilled to `quarantined`;
  partial index for sellable batches.
- `pharmacy_inventory_summary` view: physical/sellable/expired/quarantined/damaged/unbatched per product (Kampala date).
- `report_unbatched_positive_stock(tenant)`: legacy positive-stock products with no usable batches.
- `receive_pharmacy_stock(...)`: new stock enters only via a real batch (genuine batch no + positive
  qty + future expiry) and syncs `product.quantity`; best-effort audit.
- `complete_pharmacy_sale(...)` (same signature) `CREATE OR REPLACE`: FEFO now excludes non-`active`
  status batches; `INSUFFICIENT_STOCK` message includes the sellable quantity for the structured error.

**Apply**
1. Confirm against the live schema first (columns/tables exist as assumed). `npm run db:diff` /
   `supabase db lint --local` where available.
2. `supabase db push --dry-run` then `supabase db push` (the CI `db-push` job does dry-run first;
   it is gated behind `ENABLE_DB_PUSH=true` + `SUPABASE_ACCESS_TOKEN`).
3. Run the security-advisor after apply (RLS on new objects; the view inherits base-table RLS).

**Rollback** (documented in the file header): drop the view + `report_unbatched_positive_stock` +
`receive_pharmacy_stock`; restore `complete_pharmacy_sale` from
`20260730120000_pos_sale_idempotency_in_rpc.sql`; the added columns are harmless to keep and may be
dropped only if required.

**Not applied in this environment** — no live DB / Supabase MCP unauthenticated. Validated with
`npm run db:check` (file integrity) and review only.

## Follow-up (recommended)
Snapshot the live pharmacy DDL (`pharmacy_products`, `pharmacy_product_batches`, `pharmacy_pos_sales`,
`pharmacy_pos_sale_items`, `pharmacy_stock_adjustments`, packages/suppliers/POs, cashier sessions/carts)
into a baseline migration so the repo is reproducible from scratch (audit §0/§3).
