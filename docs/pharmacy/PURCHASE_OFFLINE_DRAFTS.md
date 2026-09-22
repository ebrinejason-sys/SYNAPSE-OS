# Pharmacy purchase offline drafts (Expo)

**Date:** 2026-09-22  
**Status:** Safe local DRAFT only — not full offline purchase sync

## What ships

- Incomplete Expo purchase entry persists to `AsyncStorage` key `synapse.pharmacy.purchase.draft.v1`.
- Status vocabulary: `DRAFT | QUEUED | SYNCING | SYNCED | FAILED | CONFLICT`.
- Only `DRAFT` is written locally today.
- Server receive still requires online confirmation; retries reuse the same idempotency key.
- A purchase is never presented as committed until `POST /api/mobile/pharmacy/purchases` succeeds.

## Explicitly deferred

- Queueing purchases through the existing `SyncCommand` outbox.
- Offline inventory application / conflict merge for purchase receipts.
- Claiming `QUEUED`/`SYNCING`/`SYNCED` without a server-backed apply path.

Do not invent a second offline architecture. Extend SyncCommand + hospital/pharmacy apply only when purchase receive can reuse `receivePharmacyPurchase` idempotency end-to-end.
