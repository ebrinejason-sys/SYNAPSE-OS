# Integrated Smoke Test (mandated 22-step end-to-end)

This documents the mandated synthetic end-to-end flow, and — honestly — which steps are
executable today versus blocked by later phases or by environment limits (no live DB access;
Supabase/Vercel MCP unauthenticated in the build environment).

> **Environment note.** The core pharmacy tables are live-only and this environment has no live
> DB, so DB-backed steps below are specified as runnable procedures for a real environment rather
> than executed here. Phase-1 domain logic is fully covered by unit tests that run in CI.

| # | Step | Depends on | Executable now? |
|---|------|-----------|-----------------|
| 1 | Platform admin creates a test hospital | Phase 4 sandbox | ❌ not built |
| 2 | Modules & departments provisioned | Phase 4 | ❌ (provisioning not transactional) |
| 3 | Synthetic admin + staff accounts | Phase 4 | ⚠️ partial (onboarding lacks invite/tx) |
| 4 | Register synthetic patient | existing clinical | ✅ (web, needs tenant) |
| 5 | Record complaint + examination finding separately | Phase 5 | ❌ (single diagnoses table today) |
| 6 | Clinician selects ICD-11 diagnosis | Phase 5 | ⚠️ code-only today |
| 7 | Lab order + synthetic result | existing lab | ✅ (schema exists) |
| 8 | Internal referral sent + accepted | Phase 7 | ⚠️ 5-state only |
| 9 | Admit patient to ward | Phase 8 | ❌ not built |
| 10 | Ward medication request → pharmacy | Phase 8 | ❌ not built |
| 11 | Pharmacy dispenses from valid FEFO batch | Phase 1 | ✅ **RPC enforces FEFO + status** |
| 12 | POS sale completes | existing + Phase 1 | ✅ |
| 13 | Receipt previews in app | Phase 3 | ❌ not built |
| 14 | Receipt saved + shared | Phase 3 | ❌ not built |
| 15 | Sales history opens full receipt | Phase 3 | ⚠️ list only today |
| 16 | Trajectory AI cites evidence | Phase 6 | ❌ not built |
| 17 | 3 related syndrome records → signal | Phase 9 | ❌ (naive count today) |
| 18 | Signal does not auto-confirm outbreak | Phase 9 | ❌ (no state machine yet) |
| 19 | DHO reviews + opens investigation | Phase 9 | ❌ not built |
| 20 | Monitoring shows test-tenant health | Phase 4 | ⚠️ partial/synthetic today |
| 21 | Reset test tenant removes only synthetic data | Phase 4 | ❌ not built |
| 22 | Cross-tenant access tests fail as expected | all | ⚠️ enforced in code; needs live-DB integration test |

## Phase-1 verifiable today (this branch)
Because the core tables are live-only, Phase-1 correctness is proven by **unit tests** over the
shared domain (`apps/pharmacy/lib/pos/inventory-authority.test.ts`, 24 cases) plus the existing
POS route/idempotency/FEFO suites:

- product-level stock with no batches → `sellableQuantity = 0`, `UNBATCHED_STOCK` error
- expired-only, mixed expired/valid, quarantined/damaged/recalled exclusion
- split FEFO allocation across batches; expired/quarantined skipped
- two cashiers racing the last units (deterministic winner; loser gets structured error)
- stock adjustment, receiving, refund/void reflected in `sellableQuantity`
- import validation: batch number + positive integer quantity + non-past expiry required to make
  previously-unbatched medicine sellable; past-expiry rejected

Run: `npm run test --workspace @synapse/pharmacy` and `npm run verify:pharmacy`.

## DB-integration coverage to add when a DB is available
`complete_pharmacy_sale` against seeded synthetic batches (FEFO order, status exclusion,
`INSUFFICIENT_STOCK` structured message, idempotent retry), `receive_pharmacy_stock`
(batch creation + product sync + past-expiry rejection), `report_unbatched_positive_stock`,
and a cross-tenant rejection test. These belong in a `supabase test`/pgTAP or a seeded
integration harness — see `docs/release/implementation-status.md`.
