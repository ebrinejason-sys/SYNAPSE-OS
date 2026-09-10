# Facility Invitation Hardening

Status date: 2026-09-10. Repository HEAD at time of writing: see `git rev-parse HEAD`.

Facility staff invitations remain fully disabled in production. `POST /api/platform/facilities/[id]/staff` unconditionally returns `503 FACILITY_INVITE_HARDENING_REQUIRED` for every authorized caller, with no flag or environment variable that re-enables the legacy path. `apps/web/src/lib/control-plane-security.test.ts` asserts the route source contains no reachable legacy handler. This gate stays closed until every item below reaches "staging evidence" or later.

## What "done" means here

This report distinguishes four different levels of confidence on purpose, because none of them substitute for the others:

- **Completed code** — implemented, reviewed in this repository, and exercised by at least one automated test run in this environment.
- **Isolated tests** — automated tests that ran and passed in this environment. Mock-based unit tests prove business-logic branches only; they cannot prove transaction atomicity, unique-constraint enforcement, RLS, or concurrency. DB-backed integration tests prove those, but only against whatever Postgres instance `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` point to in the environment that ran them — not against the production project unless that is explicitly stated.
- **Staging evidence** — a recorded run of the synthetic staging journey (see below) against an authorized, non-production Supabase project, with the resulting evidence artifact checked in or linked.
- **Production blockers** — concrete, named actions a human operator must still take before this can run against the production project. These are never described as "credential-only"; several are code/schema verification steps, not just secret provisioning.

## Completed code (this pass)

- `supabase/migrations/20260910130000_facility_invitations_acceptance_tx.sql` — additive migration adding `facility_invitations.department_id`, an append-only `facility_invitation_audit` table, and two `SECURITY DEFINER` Postgres functions (`accept_facility_invitation_existing_user`, `accept_facility_invitation_new_account`) that perform invitation consumption, `staff_scope_assignments` writes, and audit logging as one transaction, with the invitation row locked `FOR UPDATE` for concurrency safety. Not applied to any Supabase project by this task.
- `apps/web/src/lib/platform/facility-invitations.server.ts` rewritten to:
  - separate **existing-user acceptance** (`acceptFacilityInvitationForExistingUser`, requires an already-authenticated session profile whose email matches the invitation; never touches `password_hash`) from **new-account registration** (`registerFacilityInvitationNewAccount`, only reachable when no profile exists for the invited email; hashes the supplied password once, server-side);
  - persist and re-validate the invited `department_id` at acceptance instead of ignoring it;
  - never set `onboarding_complete: true` or any professional-credential field on acceptance; new accounts receive `email_verified_at` because the invitation token proves inbox control, while `verification_status` remains `unverified` until the separate approval workflow completes;
  - delegate all success consumption/membership/audit writes to the transactional RPCs above instead of sequential, individually-fallible `update`/`insert` calls. A failed RPC is rolled back by PostgreSQL, so the service boundary records a separate sanitized `ACCEPT_FAILED` event afterward; that distinction is intentional and documented rather than claiming a pre-`RAISE EXCEPTION` row survives.
- `packages/auth/src/mfa-recency.ts` (`hasRecentVerifiedMfa`, `verifyStepUpMfa`) reuses the existing `mfa_enrollments`/TOTP architecture (`packages/auth/src/totp.ts`) while binding assurance to the validated `synapse_sessions.id`; revoked or expired sessions cannot inherit another session's assurance, and the per-session TOTP time-step replay key plus the existing auth rate limiter are reused. The step-up path handles enrollment-read and assurance-write failures explicitly.
- `scripts/check-reconciliation-evidence.mjs` — a new, read-only checker for operator-supplied production-migration reconciliation evidence. It fails closed unless the evidence is bound to the current worktree's full HEAD SHA, a checked-in remote-ledger snapshot file (hash-verified), the current local migration hashes (`migration-history.json`), and a reviewed pending-migration set that matches what `check-migration-history.mjs` actually reports as new — and it separately reports `operatorConfirmed` (a human attestation) from `boundEvidenceVerified` (this script's own checks). It never authorizes applying a migration (`productionMigrationAuthorization: "NEVER_GRANTED_BY_THIS_CHECK"`), and its result is surfaced in `readiness-report.mjs` outside the fields that can produce an overall `PASS`.

## Isolated tests (ran in this environment)

- `apps/web/src/lib/platform/facility-invitations.server.test.ts` (12 tests, mock-only) — input validation, schema-compatibility gating, department scoping at creation, wrong-recipient rejection, password-untouched-on-existing-user-acceptance, no-premature-onboarding-complete, identity-already-exists rejection, expired/revoked rejection, unknown-token rejection. **Does not** prove transaction atomicity, concurrency, or RLS.
- `apps/web/src/lib/platform/facility-invitations.integration.test.ts` (7 tests, real-DB) is present for transaction, concurrency, membership, department, retry, and professional-verification evidence, but **was not executed** because the supported local Supabase stack aborts during `20260609_missing_operational_tables.sql`: `public.pharmacy_customers` is referenced but never created in the checked-in migration chain. The suite's 7 skipped tests are not completion evidence.
- `apps/web/src/app/api/platform/simulation/route.test.ts` (6 tests) and `apps/web/src/app/api/platform/mfa/step-up/route.test.ts` (5 tests) — mock-based route tests for the new MFA step-up gate on destructive reset. All 11 passed.
- `scripts/check-reconciliation-evidence.test.mjs` (7 tests) and the existing `scripts/readiness-report.test.mjs` (15 tests, still passing after this change) — passed.
- Full current `test:control-plane` run in this environment: 73 passed, 7 skipped (the DB-backed invitation suite above), 0 failed.

## Production blockers (none of these are "credential-only")

1. **Apply and verify the migration against the real Supabase project.** This requires the operator-controlled reconciliation workflow already documented in `docs/readiness/PRODUCTION_MIGRATION_RECONCILIATION_2026.md` and `docs/readiness/MIGRATION_ALIGNMENT_2026.md` — the remote ledger is not currently reconciled with this repository's migration history, independent of any credential. `scripts/check-reconciliation-evidence.mjs` is a new, checked-in gate for this, but it has not been run with real operator-reviewed evidence in this task, and no migration was applied.
2. **Run the DB-backed integration suite against a real, isolated (non-production) Supabase project** to obtain first-hand proof — not just code review — that the transactional RPCs, unique constraints, and row locking behave as designed outside a mock. This is a concrete verification step, not a secret-provisioning step.
3. **Prepare and execute a synthetic staging invitation journey** (create → deliver (or manually retrieve) → existing-user accept / new-account register → verify membership, department, audit row, and unchanged password/verification fields) against an authorized staging environment once (1) and (2) are done, and record the resulting evidence in this document.
4. **Wire a UI/route in front of the new service functions.** `lookupFacilityInvitation`, `acceptFacilityInvitationForExistingUser`, and `registerFacilityInvitationNewAccount` are implemented and tested in isolation but are not yet called from any HTTP route — `POST /api/platform/facilities/[id]/staff/route.ts` still only returns 503, and there is no acceptance-page route yet for the two distinct flows (sign in and accept vs. register). This is required before the 503 gate can be lifted, independent of schema/staging status.
5. **Re-verify the step-up MFA gate end-to-end** (enroll → step up → reset) against a real environment before treating it as more than unit-tested — the mock-based route tests prove the gate logic, not the live TOTP round-trip against `mfa_enrollments`.

No production migration was applied and no staging journey was executed as part of this task.
