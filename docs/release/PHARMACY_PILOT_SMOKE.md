# Pharmacy Pilot Smoke Test — SYNAPSE Pharm Pilot-Ready v1

Deterministic procedure for a controlled pilot/staging tenant.
Do **not** mark the milestone GREEN until every step PASSes against a real backend.

## Prerequisites
- Migrations applied: `20260805130000_pharmacy_inventory_authority.sql` **and**
  `20260810120000_pharmacy_pilot_authority_hardening.sql`
- Pilot seed available: `npm run seed:pharmacy-pilot` (slug `pharm-synapse-pilot`)
- Web: `pharm.synapseos.tech` (or local `:3002`)
- Android: installable preview APK or Expo dev client pointed at production/pilot API
  (`www.synapseos.tech` mobile APIs — **no localhost**)

## Procedure

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Log in as pharmacy administrator (web) | Session + tenant context | ⬜ |
| 2 | Create/select supplier | Supplier visible in list | ⬜ |
| 3 | Create/select product (catalogue qty may be 0) | Product exists | ⬜ |
| 4 | Receive Batch A (later expiry, e.g. +12 months), qty 20 | Batch row; sellable += 20 | ⬜ |
| 5 | Receive Batch B (earlier expiry, e.g. +4 months), qty 15 | Batch row; sellable += 15 | ⬜ |
| 6 | Verify inventory / sellableQuantity = 35 | Dashboard/inventory shows sellable 35; product.quantity synced | ⬜ |
| 7 | Create POS sale for 5 units | Cart validates FEFO preview starts with Batch B | ⬜ |
| 8 | Confirm FEFO selects Batch B first | Sale items / allocation show Batch B | ⬜ |
| 9 | Complete sale (server RPC) | Receipt number; status completed | ⬜ |
| 10 | Verify inventory decreased (sellable 30; Batch B qty 10) | Batch B reduced first | ⬜ |
| 11 | Open sale on web (transactions / sales) | Same sale id / receipt | ⬜ |
| 12 | Open sale on Android | Same sale | ⬜ |
| 13 | Open receipt (web + Android) | Immutable snapshot; non-fiscal unless EFRIS | ⬜ |
| 14 | Print/share receipt from Android | Print or share sheet succeeds or fails with clear UX | ⬜ |
| 15 | Authorized refund/reversal with reason | Sale voided; stock restored as **quarantined** by default | ⬜ |
| 16 | Verify audit trail | `REFUND_POS_SALE` / stock.received / sale events present | ⬜ |
| 17 | Verify stock state post-refund | Quarantined qty increased; sellable not blindly reopened unless restoreAs=active | ⬜ |
| 18 | Second tenant cannot access these records | 404/empty for other tenant id | ⬜ |

## Negative checks (required)
| Check | Expected | Result |
|-------|----------|--------|
| Increase stock without batch/expiry | 400 REQUIRES_BATCH | ⬜ |
| PO RECEIVED without receiptItems | 400 REQUIRES_BATCH | ⬜ |
| Sell expired-only product | INSUFFICIENT_STOCK / no sellable | ⬜ |
| Repeat refund same sale | 409 ALREADY_REFUNDED | ⬜ |
| Bare product.quantity correction on mobile | Rejected with pharmacy language | ⬜ |
| Anon/authenticated direct RPC execute | Permission denied after hardening migration | ⬜ |

## Agent environment note (2026-08-10)
This cloud agent has **placeholder** Supabase credentials (`placeholder-project.supabase.co`).
Live smoke steps above are **NOT executed here**. Domain FEFO/import unit tests + `db:check` +
pharmacy verify are the demonstrated gates in-repo; live PASS/FAIL must be filled after
migrations are applied to the real SYNAPSE_OS project.
