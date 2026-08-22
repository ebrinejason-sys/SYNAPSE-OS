# ADR 0004 — Sync is a typed command envelope, not HTTP replay

## Status

Accepted

## Context

Pharmacy offline checkout previously treated no-op storage as success. The master blueprint requires durable local authority, an outbox, idempotent server apply, acknowledgement, checkpoint, and reconciliation. Last-write-wins is unsafe for stock and money.

Open PR `#36` (`packages/offline`) defined a competing protocol. That design is **not** merged. Core owns one envelope: `SyncCommand`.

## Decision

1. Every offline mutation is a `SyncCommand` (`@synapse/db/sync-contract`).
2. `commandId` is the idempotency key written to `offline_mutation_outbox.idempotency_key`.
3. Same `commandId` + same `payloadHash` is a safe replay. Same `commandId` + different hash is human-review conflict (`COMMAND_HASH_MISMATCH`).
4. Payload hashes are SHA-256 of canonical JSON. Clients and servers must use the same algorithm; never a weaker fallback.
5. Persistence runtime (Expo SQLite / web encrypted store / Edge) is owned by the Offline Sync agent. The contract is owned by Core.
6. Pharmacy POS, inventory RPCs, and `complete_pharmacy_sale` remain the online execution engines. Sync applies those engines; it does not replace them.
7. SQL outbox statuses are `queued|syncing|applied|conflict|rejected`. Client envelope status `acknowledged` maps to SQL `applied`.

## Consequences

Feature teams may add command types only by extending `SYNC_COMMAND_TYPES` with Core review. They may not introduce a second queue format.
