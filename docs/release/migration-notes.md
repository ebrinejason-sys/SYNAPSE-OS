# Migration Notes

## 20260819120000_pharmacy_stock_transfers_execute.sql (PR E)

**Type:** additive, reversible. Depends on `pharmacy_stock_transfers` from `20260817120000`.

**Changes**
- `pharmacy_stock_transfer_item_allocations` ledger (source batch identity for destination receipt)
- `ship_pharmacy_stock_transfer` — draft → in_transit, FEFO deduct at source store
- `receive_pharmacy_stock_transfer` — in_transit → received, recreate/top-up genuine batch at destination
- EXECUTE granted to `service_role` only

**Does not** change `pharmacy_products.quantity` (tenant-wide physical total is unchanged by internal transfer).

**Live status:** not applied in this environment. Dry-run before `db push`.

## 20260822120000_generate_synapse_id_person_compat.sql (PR A)

**Type:** additive, reversible. **Does not** edit `20260817120000` in place.

**Changes**
- Recreates `generate_synapse_id(text)` with valid `ascii(substr(...))` and collision checks against `persons` and `patient_profiles`.
- Does **not** replace or revoke live zero-arg `generate_synapse_id()` used by `patient_profiles`.

**Apply:** with other pending identity migrations after dry-run. Safe if `20260817120000` was already applied.

## 20260810120000_pharmacy_pilot_authority_hardening.sql (Pilot v1)
**Type:** additive, reversible. **Depends on** concepts from `20260805130000` (safe to apply even if
that migration was partially applied — this file re-asserts status columns / summary view).

**Changes**
- Batch status check includes `exhausted`; zero-qty active batches marked exhausted (best-effort).
- `receive_pharmacy_stock` recreated with selling price / supplier / PO / store / reason params.
- `adjust_pharmacy_batch_stock` — INCREASE→receive; DECREASE FEFO or batch-scoped; CORRECTION requires batch_id; DAMAGE/QUARANTINE/RECALL status updates.
- `reverse_pharmacy_sale` — idempotent void; default restore **quarantined** (not blindly sellable).
- Least privilege: revoke EXECUTE of privileged pharmacy RPCs from `public`/`anon`/`authenticated`; grant `service_role`.

**Live status (2026-08-10):** not applied. Confirmed absent via anon schema probe.

**Apply:** only with verified service-role credentials against project `qfqakzmjatszisuqjwon` after dry-run.
Do not apply from environments whose `.env` points at `placeholder-project.supabase.co`.

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
1. Confirm against the live schema first.
2. Prefer applying **both** `20260805130000` and `20260810120000` in order.
3. `supabase db push --dry-run` then `supabase db push` (CI gated by `ENABLE_DB_PUSH` + token).
4. Verify grants / security advisor after apply.

**Live status (2026-08-10):** still **not applied** (no `status` column / summary view / receive RPC).

## Follow-up (recommended)
Snapshot live pharmacy DDL into a baseline migration for reproducibility.
Drop obsolete `complete_pharmacy_sale` overloads if PostgREST still reports ambiguity after replace.
