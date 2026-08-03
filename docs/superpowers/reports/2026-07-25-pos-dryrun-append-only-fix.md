# POS dry-run — 2026-07-25

## Finding

Live `complete_pharmacy_sale` failed on pilot with:

`APPEND_ONLY: financial fields of a completed sale are immutable`

Cause: RPC inserted `status='completed'` with zero totals, then UPDATEd `subtotal` / `discount_total` / `total_amount`. Trigger `guard_pos_sale_mutation` correctly blocks financial edits on completed sales.

## Fix

Migration `20260725140000_fix_complete_sale_pending_then_complete.sql`:

1. Insert sale as `pending` (no confirmation yet)
2. FEFO-decrement batches + insert line items
3. Single UPDATE setting totals + `status='completed'` + `confirmed_by` / `confirmed_at`

## Pilot verification (after fix)

Sale of 5× PARA-500 @ 100 UGX as `pilot.cashier`:

| Check | Expected | Result |
|---|---|---|
| Receipt | `R-20260725-0001` | verified |
| Status | completed | verified |
| FEFO batch | PARA-SOON (not PARA-EXP) | verified |
| PARA-SOON qty | 40 → 35 | verified |
| PARA-EXP qty | 20 unchanged | verified |
| Total | 500 | verified |

Password for UI retest: `PilotDemo2026!` / `pilot.cashier@synapseos.tech`
