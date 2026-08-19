# Agent organization (Lead Architect)

Cursor branch prefix for this environment: `cursor/<name>-e7a0`.

| Agent | Owns | Model class | Branch |
|---|---|---|---|
| Lead Architect | contracts, ADRs, merge gate, registry | strongest reasoning | `cursor/orchestrator-milestone-a-e7a0` |
| Database / Core | persons, facilities, sync schema, inventory/financial ledgers | strongest reasoning | same as Lead until delegated |
| Pharmacy domain | POS, inventory RPCs, receiving, transfers, receipts | implementation | `cursor/pharm-inventory-e7a0` |
| Offline Sync | durable local DB, outbox, apply, checkpoint | strongest reasoning | `cursor/pharm-offline-sync-e7a0` |
| Expo pharmacy | native POS/stock UI consuming contracts | implementation | `cursor/pharm-expo-e7a0` |
| Pharmacy security/finance review | RPC ACLs, till, refunds, tenant isolation | strongest reasoning | review-only |
| QA | journey tests, restart tests, smoke | implementation / fast for repetitive | `cursor/qa-pharm-e7a0` |
| Identity/MPI | persons, identifiers, match, merge audit | strongest reasoning | Core-gated |
| FHIR/Interop | adapters onto canonical types | strongest reasoning | docs until Core opens |
| Clinical journey | registration→follow-up integration | strongest reasoning | docs until Milestone A offline slice exists |
| Terminology | ICD-11 server cache, no browser secrets | strongest reasoning | docs / later package |
| Synapse Edge | LAN authority using the same sync contract | strongest reasoning | docs until protocol ships |
| Accessibility | WCAG AA, keyboard, TalkBack | implementation | with Expo/pharmacy UI |
| Security review | auth, RLS, RBAC, patient/finance attack | strongest reasoning | review-only |

## Merge gate

implementation → tests → specialist reviewer → integration tests → Lead Architect → merge.

Identity, medical records, finance, inventory, auth, and offline sync require the strong path.

## No placeholder rule

If `docs/implementation/capability-registry.json` says `PLANNED`, do not ship a fake operational UI.
