# Release 0 — Pharm money path + fake offline kill (2026-07-30)

Implements the first Release 0 Pharm track from `SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md` §20.1 / §21.

## Done

### 1. Fake offline disabled
- POS checkout offline branch **hard-fails** (no mock receipt, no cart clear).
- `resilientFetch` returns **503** for mutations when offline / network fails — never fake `success: true`.
- `offlineStorage.queueMutation` / `saveOfflineTransaction` **throw** `OfflineUnavailableError`.

### 2. Canonical ledger readers
POS truth = `pharmacy_pos_sales` / `pharmacy_pos_sale_items`. Order/legacy txs still live in `pharmacy_transactions` until migrated.

| Surface | Change |
|---|---|
| Dashboard | Revenue / today / cashier stats via `sumCompletedRevenue` (POS + order) |
| Transactions history | `listLedgerSalesForHistory` (POS + order), unified UI shape |
| Sales reset | Deletes POS items/sales **and** order txs |
| Refunds | Prefer **void POS sale** (+ batch/product restock); fallback to order `REFUNDED` |
| Sales reports | Merges POS sales/items into sales report aggregates |

Helper: `apps/pharmacy/lib/pos/sale-ledger.ts`

### 3. Idempotency
- App layer stores `sale_id` from RPC `sale_id` field (was wrongly reading `id`).
- RPC accepts optional `p_idempotency_key` and **claims the key in the same transaction** as the sale.
- Migration: `supabase/migrations/20260730120000_pos_sale_idempotency_in_rpc.sql` (applied on SYNAPSE_OS when MCP succeeds).

## Remaining Release 0 Pharm gaps
- Profit report path still primarily `pharmacy_transactions` (sales report fixed; profit needs same merge).
- Transaction edit / verify UIs still assume order-tx schema — disable or retarget.
- Customer-identity P0 and subscription-lock degradation not started.
- Durable offline queue still intentionally absent.

## Verify
```bash
npm run type-check --workspace=@synapse/pharmacy
npm run test --workspace=@synapse/pharmacy
```
Pilot cashier sale should appear on dashboard + transactions + sales report.
