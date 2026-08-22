# Milestone A — SYNAPSE Pharm offline-first pilot

Owner: **Offline Sync** (protocol runtime) + **Pharmacy domain** (sale/stock engines).
Contract: ADR 0004, `@synapse/db/sync-contract`.
Registry flag: `pharm/offline_durable_pos` is **PARTIAL** (SQLite outbox + apply BFF + local reservation). It stays short of **PILOT_READY** / **OPERATIONAL** until device-restart proof and live backend apply exist.

## Current truth

- Online POS uses `complete_pharmacy_sale` (FEFO, idempotent). Status: **PARTIAL** until till enforcement and quantity side-doors are closed.
- Web POS refuses offline completion (`OfflineUnavailableError`) and tells the cashier nothing was charged. Keep that honesty until durability exists.
- Expo POS commits `SyncCommand` to SQLite before UI success, then flushes `/api/mobile/pharmacy/sync/apply`.
- `offline_mutation_outbox` is written by the apply BFF before `complete_pharmacy_sale`.
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
