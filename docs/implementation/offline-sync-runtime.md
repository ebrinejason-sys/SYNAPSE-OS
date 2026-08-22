# Pharmacy offline sync runtime

Expo pharmacy POS commits each sale as the frozen `SyncCommand` envelope **before**
showing saved / pending-sync UI. The device outbox is `expo-sqlite` (`synapse-sync-v1.db`)
with WAL and `synchronous=FULL`. Cart drafts remain in AsyncStorage and are never
treated as financial commits.

## State flow

1. POS caches the latest sellable catalogue (batch quantities) into SQLite.
2. Cashier completes a sale. Expo hashes the canonical payload with SHA-256 and
   inserts the command as `queued` **in the same SQLite transaction** as local FEFO
   reservations. `commandId` is the local PK and the server idempotency key.
3. UI then shows **Pending sync**. It does not wait for HTTP success to persist.
4. The retry worker posts the typed command to `/api/mobile/pharmacy/sync/apply`.
   The server writes `offline_mutation_outbox` first, then applies through the
   existing mobile complete-sale BFF and `complete_pharmacy_sale` RPC.
5. Same id + hash is a replay (one sale). A different hash is `conflict` / human
   review — never last-write-wins.
6. Successful apply records ack id + checkpoint. SQLite commits local
   `acknowledged` and the tenant checkpoint together, then consumes the
   reservation from the snapshot.
7. Network/5xx return the row to `queued`. Process restart retries `syncing` and
   `applied` (crash before local ACK). Insufficient stock is `rejected` and
   releases the local reservation.

## Offline boundaries (honest)

Allowed: cash sale against a fresh catalogue snapshot; card/mobile-money stored as
`offline_unverified` (not provider success).

Blocked: selling with no snapshot; selling when the snapshot is older than 4 hours
(`OFFLINE_STOCK_STALE`); a second offline sale that would oversell reserved stock
(`INSUFFICIENT_STOCK`).

Web POS remains online-only (`OfflineUnavailableError`).

## Encryption / device storage

This slice uses the Android/iOS app sandbox plus device lock. It does **not** ship
SQLCipher. Sale payloads store product ids, quantities, and prices — not service-role
keys and not clinical notes. Encrypted-at-rest is required before OPERATIONAL.

## Capability

`pharm/offline_durable_pos` = **PARTIAL**. Device-restart proof and live backend
apply are still required for PILOT_READY / OPERATIONAL.
