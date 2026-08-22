# Agent organization (Lead Architect)

Cursor branch prefix for this Pharm hardening stream: `cursor/<name>-bf39`.

| Agent | Owns | Must not invent |
|---|---|---|
| Lead Architect / Integrator | contracts, ADRs, merge gate, registry | competing architecture |
| Pharmacy domain | POS, inventory RPCs, receiving, transfers, receipts, refunds | second outbox or stock ledger |
| Offline Sync | durable local DB, outbox, apply, checkpoint, conflicts | last-write-wins merge |
| Expo / Android | native pharmacy workflows consuming contracts | web-portal substitutes for counter work |
| Database / Supabase | additive migrations, drift, grants | in-place edits of shipped SQL |
| Security / RBAC / RLS | tenant/store isolation, RPC ACLs | weakening grants to make tests pass |
| QA / E2E | failure injection, smoke, release evidence | claiming OPERATIONAL without evidence |
| Accessibility / UX | WCAG AA, TalkBack labels, keyboard POS | color-only status |
| CI / Build / Release | hard gates, `verify:pharm-release` | `echo success` stubs |
| Observability / Audit | structured events, no secrets/PHI in logs | a third audit table without migrating writers |

## Merge gate

implementation → tests → specialist review → integration tests → Lead Architect → merge.

Identity, medical records, finance, inventory, auth, and offline sync require the strong path.

## No placeholder rule

If `docs/implementation/capability-registry.json` says `PLANNED`, do not ship a fake operational UI.
