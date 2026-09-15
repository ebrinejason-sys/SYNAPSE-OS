# SYNAPSE Functional Scorecard

> Integration update 2026-09-15: disconnected notes document reload is gated.
> The v3 plaintext clinical-response cache was removed; encrypted drafts remain.
> Historical offline reload evidence must not be used to promote v4 readiness.

Date: 2026-09-13
Baseline (historical): `76d80e92876e30ca1fe628acc9d30dd30fdf674a`
Reconciled against working tree; cite `git rev-parse HEAD` for current SHA. Domain/HTTP PASS ≠ LIVE_PROOF.


This scorecard is intentionally conservative. A capability cannot be GREEN from route presence alone. `LIVE_PROOF` requires an executable journey or acceptance artifact on the current SHA.

| Capability | CODE | DATABASE | RBAC | RLS | UI | API | PERSISTENCE | LIVE_PROOF | EAFYA | ALIS | STATUS | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Patient registration | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Duplicate and reload journey |
| Identity / Synapse ID | Y | Y | Y | Y | Y | Y | Y | N | Has | Partial | YELLOW | Cross-facility crosswalk proof |
| Queue / visit | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Durable status journey |
| Triage | Y | Y | Y | Y | Y | Y | Y | N | Partial | N/A | YELLOW | Full vital and danger-sign coverage |
| Clinical write-up | Y | Y | Y | Partial | Y | Y | Y | Partial | Partial | N/A | YELLOW | Online write-up + offline queue bridge; live offline recovery NOT VERIFIED |
| Orders and result review | Y | Y | Y | Y | Y | Y | Y | N | Has | Partial | YELLOW | Cross-module golden proof |
| Pharmacy bridge | Y | Y | Y | Y | Y | Y | Y | Y | Has | N/A | YELLOW | Live synthetic decrement+idempotency proven 2026-09-11; still needs full Hospital Golden closeout |
| Billing / disposition | Y | Y | Y | Y | Partial | Y | Y | N | Partial | N/A | YELLOW | Policy and non-revenue paths |
| Inpatient / discharge | Partial | Partial | Y | Y | Partial | Partial | Partial | N | Partial | N/A | RED | Admission-transfer-discharge lifecycle |
| Referrals | Y | Y | Y | Partial | Partial | Y | Y | Y | Missing | Partial | YELLOW | Live two-tenant PASS 2026-09-12 (service-role script — not browser auth proof) |
| Lab worklist | Y | Y | Y | Partial | Y | Y | Y | N | Has | Partial | YELLOW | Domain+HTTP auth PASS; browser/DB/RLS acceptance NOT VERIFIED |
| Lab verification / release | Y | Y | Y | Partial | Y | Y | Y | N | Has | Has | YELLOW | Amend wired in hospital-lab-db; live browser release NOT VERIFIED |
| Lab Edge / analyzer | Y | Y | Y | Y | Partial | Y | Y | N | Better | Partial | YELLOW | End-to-end cloud acceptance |
| FHIR Lab output | Partial | Y | Y | Y | N/A | Y | Y | N | Better | Partial | YELLOW | Released-result authorization proof |
| Platform Admin | Y | Y | Y | Y | Y | Y | Y | N | N/A | N/A | YELLOW | Unified readiness evidence |
| Subscriptions / grants | Y | Y | Y | Y | Y | Y | Y | N | N/A | N/A | YELLOW | Production acceptance evidence |
| Security / tenancy | Y | Partial | Y | Partial | N/A | Y | Y | Partial | N/A | N/A | YELLOW | Expand direct-ID negative tests |
| Offline | Partial | Partial | Y | Partial | Partial | Y | Partial | N | N/A | Partial | YELLOW | SyncCommand+sync/apply+browser write-up queue bridge; browser disconnect acceptance NOT VERIFIED |

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

The functional rows remain conservative. 2026-09-12: Lab domain golden (`lab-golden-journey-2026-09-12.md`) landed for specimen/TAT/amend/report; LIVE_PROOF stays N until a live pilot journey. Infrastructure proof does not promote clinical write-up, inpatient, referrals, offline, Lab TAT, or ALIS quality/inventory rows to GREEN.


## 2026-09-11 UPDATE

Evidence that supersedes older “migration deadlock / no live clinical proof” statements in this file’s 2026-09-09 rows:

- Production migration ledger reconciled; pending migrations applied (PR #57 evidence under `docs/engineering/evidence/`).
- Facility invitation create→register→membership live journey PASS.
- OPD prescribe→verify→dispense: domain golden (PR #58), HTTP route tests (PR #59), live synthetic DB journey PASS (PR #60).
- Dispense stock authority corrected to `pharmacy_product_batches`.

Still RED / incomplete for RC1: full doctor write-up parity, inpatient lifecycle, referrals, clinical offline, and a single end-to-end Hospital Golden Journey (Reception→…→disposition/payment/close).

Release-control gap: GitHub branch protection/rulesets unavailable on this private free-plan repo — see `docs/engineering/RELEASE_CONTROL.md`.

## 2026-09-12 — Hospital Golden Journey live
Live synthetic PASS (write-up → dispense → disposition → sign). Domain lab branch + inpatient lifecycle foundation added. See evidence under `docs/engineering/evidence/hospital-golden-live-2026-09-12.md`.

## 2026-09-12 — Referrals live + clinical offline
Live two-tenant referral PASS; clinical offline write-up SyncCommand domain proof. See evidence under `docs/engineering/evidence/`.

## 2026-09-12 — Hospital sync flush + MFA step-up proofs
- `POST /api/hospital/sync/apply` for `clinical.encounter.writeup.v1` (Vitest HTTP proof + verify wiring).
- MFA step-up domain + HTTP proofs remain green; live TOTP round-trip now PASS (see update below).
- Evidence: `docs/engineering/evidence/hospital-sync-apply-writeup-2026-09-12.md`, `docs/engineering/evidence/mfa-step-up-live-probe-2026-09-12.md`.

## 2026-09-12 — MFA step-up live TOTP
Live PASS: enrolled admin secret → TOTP → `verifyStepUpMfa` → `hasRecentVerifiedMfa` on pilot session. Evidence: `docs/engineering/evidence/mfa-step-up-live-2026-09-12.md`.

## 2026-09-12 — Admin SHA alignment
Platform Admin production truth now compares GitHub main ↔ Vercel production ↔ process SHA and repo ↔ remote migration heads (RPC). Evidence: `docs/engineering/evidence/admin-sha-alignment-2026-09-12.md`.

## 2026-09-12 — Landing cleanup
Removed unused `LandingParticleField` component (no remaining imports).

## 2026-09-12 — Clinical offline disposition SyncCommand
Domain + HTTP flush for `clinical.encounter.disposition.v1` via hospital sync apply. Evidence: `docs/engineering/evidence/clinical-offline-disposition-2026-09-12.md`.

## 2026-09-12 — Surprise: offline triage + RC1 pulse
`clinical.encounter.triage.v1` completes the offline clinical trio. Admin deployments page shows evidence-backed RC1 pulse. See `docs/engineering/evidence/clinical-offline-triage-2026-09-12.md` and `rc1-pulse-2026-09-12.md`.

## 2026-09-12 — Clinical offline prescribe SyncCommand
`clinical.encounter.prescribe.v1` domain + hospital sync apply. Evidence: `docs/engineering/evidence/clinical-offline-prescribe-2026-09-12.md`.


## 2026-09-13 — Acceptance honesty (Lab + Offline)

| Layer | Lab | Offline clinical |
|---|---|---|
| Domain tests | PASS (`test:lab-golden-journey`) | PASS (writeup/triage/prescribe/disposition) |
| HTTP/API tests | PASS auth boundaries (`test:lab-actions`); mocked | PASS sync/apply mocked (`test:hospital-sync-apply`) |
| Real DB persistence | NOT VERIFIED this slice (no disposable lab journey run recorded) | Outbox table used by sync/apply; browser localStorage queue is durable per actor |
| Browser acceptance | NOT VERIFIED — see `docs/engineering/MANUAL_ACCEPTANCE_LAB_OFFLINE.md` | NOT VERIFIED — same manual doc |
| Role / tenant isolation | HTTP mocked PASS; RLS live NOT VERIFIED | Server apply uses session tenant/actor; client tenantId not trusted |
| Outstanding blocker | Live specimen/TAT/amend through app on disposable DB | Disconnect/reload/reconnect browser run; triage/prescribe/disposition UI offline hooks |
| Next action | Execute manual lab procedure on disposable env; record SHA | Execute manual offline procedure; wire remaining command UIs if needed |

RC1 Admin pulse now labels each gate `domain` | `http` | `live`. Evidence file presence alone never implies live workflow PASS.
