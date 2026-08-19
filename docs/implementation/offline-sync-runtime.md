# Pharmacy offline sync runtime

Milestone A commits each Expo pharmacy sale as the frozen `SyncCommand` envelope before
showing any saved state. The device outbox is a dedicated `expo-sqlite` database using
WAL mode and `synchronous=FULL`; cart drafts remain in AsyncStorage but are never treated
as financial commits.

## State flow

1. Expo hashes the canonical sale payload with SHA-256 and atomically inserts the command
   in SQLite as `queued`. `commandId` is both the local primary key and server idempotency
   key.
2. The retry worker sends the typed command to
   `/api/mobile/pharmacy/sync/apply`. The server persists it in
   `offline_mutation_outbox` before applying it through the existing mobile complete-sale
   BFF and `complete_pharmacy_sale` RPC.
3. Same ID and hash is a replay. A different hash changes the command to `conflict` for
   human review; it never overwrites the original payload.
4. A successful server apply records an acknowledgement ID and checkpoint. SQLite commits
   the local `acknowledged` state and tenant checkpoint in one transaction.
5. Network and server failures return the local row to `queued`. A process restart also
   retries rows left in `syncing` or `applied`. Insufficient stock is `rejected`, never
   `applied`.

Web POS remains online-only and continues to throw `OfflineUnavailableError`; this slice
does not claim a durable encrypted web queue.
