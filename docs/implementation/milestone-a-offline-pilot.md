# Milestone A — SYNAPSE Pharm offline-first pilot

Owner: **Offline Sync** (protocol runtime) + **Pharmacy domain** (sale/stock engines).
Contract: ADR 0004, `@synapse/db/sync-contract`.
Registry flag: `pharm/offline_durable_pos` remains **PLANNED** until the gates below are green.

## Current truth

- Online POS uses `complete_pharmacy_sale` (FEFO, idempotent). Status: **PARTIAL** until till enforcement and quantity side-doors are closed.
- Web POS refuses offline completion (`OfflineUnavailableError`) and tells the cashier nothing was charged. Keep that honesty until durability exists.
- Expo keeps a cart draft and sale idempotency key; it does not persist a committed sale across restart without network.
- `offline_mutation_outbox` exists in SQL; no application writer on this PR.
- `SyncCommand` / `SyncEnvelope` are locked. Runtime (SQLite + apply API) follows in a dedicated PR that consumes this contract — not `packages/offline` from PR #36.

## Acceptance (OPERATIONAL)

1. Local encrypted/durable store commits the `SyncCommand` **before** UI success or receipt.
2. Application restart and device restart recover the queued command.
3. Replay with the same `commandId` + `payloadHash` does not double-sell.
4. Different payload for the same `commandId` is conflict / human review — never last-write-wins.
5. Server apply uses existing inventory RPCs; it does not mutate `product.quantity` directly.
6. Outbox checkpoint + acknowledgement are recorded.
7. Automated tests cover: happy path, restart, duplicate replay, insufficient stock, tenant isolation, hash mismatch.
8. Web and Expo either share the contract or explicitly remain online-only with the existing refusal — no fake sync.

## Out of scope for this slice

- Multi-counter shared stock during WAN loss (that is Edge LAN authority).
- EFRIS fiscal receipts.
- Clinical journey / FHIR / ICD-11 operational UIs.
