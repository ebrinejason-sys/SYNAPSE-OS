# SYNAPSE Edge

Owner: **Synapse Edge agent**. Speaks the same `SyncCommand` protocol (ADR 0004). Not a second pharmacy or hospital schema.

Status: **PLANNED**. Registry: `edge/facility_lan_authority`.

## Split of duties

| Situation | Authority | Milestone |
|---|---|---|
| Single counter, WAN down | Device-local durable `SyncCommand` store | **A — Pharm offline-first** |
| Several counters, LAN up, WAN down | Facility Edge (LAN) is stock/till/receipt authority | Edge |
| Hospital wards/orders/results with LAN only | Edge + local queues | After clinical journey contracts |

Milestone A must not wait for Edge. Edge must not invent last-write-wins or a parallel inventory ledger.

## What Edge is

A facility satellite that keeps essential workflows on the LAN:

- local `SyncCommand` inbox/outbox (same envelope as Expo/web)
- idempotent apply into existing RPCs (`complete_pharmacy_sale`, receive/adjust, later clinical commands)
- encrypted persistence and backup
- local terminology snapshot (see `terminology-icd11.md`)
- adapter processes (LIS/HL7/ASTM, OpenMRS) — analyzers stay off the public internet
- monitoring of sync lag, conflict queue, disk, and certificate expiry

## What Edge is not

- A fork of `pharmacy_product_batches` or `persons`
- A generic HTTP cache or service worker
- A place to run unreviewed `SECURITY DEFINER` RPCs as `anon`

## Protocol

Reuse `@synapse/db/sync-contract`:

- `commandId` + `payloadHash` replay
- hash mismatch → human review
- checkpoint + acknowledgement
- tenant/facility/site on every command

Cloud is a replica/peer with the same invariants, not a silent overwrite of Edge stock.

## Sequencing

1. Device-local Pharm durability (Offline Sync agent).
2. Edge as the LAN apply node for the same commands (this agent).
3. Hospital Edge after Encounter/orders exist.

Database owner reviews any Edge-specific tables (ADR 0005). Prefer hosting the existing `offline_mutation_outbox` locally over creating `edge_outbox_2`.
