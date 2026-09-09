# SYNAPSE Functional Scorecard

Date: 2026-09-09
Baseline: `c1d9a65f859ec762a15bba28905d6b3dcc18aa0e`

This scorecard is intentionally conservative. A capability cannot be GREEN from route presence alone. `LIVE_PROOF` requires an executable journey or acceptance artifact on the current SHA.

| Capability | CODE | DATABASE | RBAC | RLS | UI | API | PERSISTENCE | LIVE_PROOF | EAFYA | ALIS | STATUS | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Patient registration | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Duplicate and reload journey |
| Identity / Synapse ID | Y | Y | Y | Y | Y | Y | Y | N | Has | Partial | YELLOW | Cross-facility crosswalk proof |
| Queue / visit | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Durable status journey |
| Triage | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Full vital and danger-sign coverage |
| Clinical write-up | Partial | Partial | Y | Y | Partial | Partial | Partial | N | Partial | N/A | RED | HPI/PMH/ROS/exam/plan/signature parity |
| Orders and result review | Y | Y | Y | Y | Y | Y | Y | N | Has | Partial | YELLOW | Cross-module golden proof |
| Pharmacy bridge | Y | Y | Y | Y | Y | Y | Y | N | Has | N/A | YELLOW | Pharm decrement/event/billing proof |
| Billing / disposition | Y | Y | Y | Y | Partial | Y | Y | N | Partial | N/A | YELLOW | Policy and non-revenue paths |
| Inpatient / discharge | Partial | Partial | Y | Y | Partial | Partial | Partial | N | Partial | N/A | RED | Admission-transfer-discharge lifecycle |
| Referrals | N | Partial | Y | Partial | N | Partial | N | N | Missing | Partial | RED | Active pages are stubs |
| Lab worklist | Y | Y | Y | Y | Y | Y | Y | N | Has | Partial | YELLOW | Full specimen and TAT journey |
| Lab verification / release | Y | Y | Y | Y | Y | Y | Y | N | Has | Has | YELLOW | Amendment and printable report proof |
| Lab Edge / analyzer | Y | Y | Y | Y | Partial | Y | Y | N | Better | Partial | YELLOW | End-to-end cloud acceptance |
| FHIR Lab output | Partial | Y | Y | Y | N/A | Y | Y | N | Better | Partial | YELLOW | Released-result authorization proof |
| Platform Admin | Y | Y | Y | Y | Y | Y | Y | N | N/A | N/A | YELLOW | Unified readiness evidence |
| Subscriptions / grants | Y | Y | Y | Y | Y | Y | Y | N | N/A | N/A | YELLOW | Production acceptance evidence |
| Security / tenancy | Y | Partial | Y | Partial | N/A | Y | Y | Partial | N/A | N/A | YELLOW | Expand direct-ID negative tests |
| Offline | Partial | Partial | Y | Partial | Partial | Partial | Partial | N | N/A | Partial | RED | Clinical offline scope and replay |

## Scorecard Rules

- `SKIPPED` is never PASS.
- A migration file is not evidence that the remote migration is applied.
- A Vercel READY state is not workflow proof.
- Synthetic data must be clearly synthetic and must not masquerade as live facility activity.
- Platform Admin readiness must preserve the PHI boundary; aggregate health is acceptable, arbitrary patient chart access is not.

## CONTROL PLANE BASELINE

- Security and tenant routing: PASS, 31/31 focused tests.
- Provisioning and domain contract: PASS, 10/10 tests.
- Lab Edge: PASS, 12/12 tests.
- Web typecheck, lint, and production build: PASS.
- Database package: focused provisioning tests PASS; broad direct-Node sweep is blocked by existing extensionless-import resolution and is not treated as a green full-package gate.
- Remote migrations, live synthetic journeys, and deployment SHA alignment: NOT VERIFIED locally.
- CI database secrets: workflow references `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; repository secret availability is operator-controlled and was not available locally.
- Remote migrations: DRIFT until `20260908120000` and `20260909100000` are applied and verified.
- Dependency security: YELLOW; 77 audit findings are classified in [DEPENDENCY_SECURITY_AUDIT_2026.md](DEPENDENCY_SECURITY_AUDIT_2026.md).

The functional rows remain conservative. Infrastructure proof does not promote clinical write-up, inpatient, referrals, offline, Lab TAT, or ALIS quality/inventory rows to GREEN.
