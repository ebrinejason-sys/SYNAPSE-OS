# Infrastructure Stabilization Report 2026-09-10

## Baseline

- Starting SHA: `e624986279ad8a5d26e14f838b1eff3a1003f3e9`
- Current main branch verified locally before changes.
- Worktree contains the existing implementation changes plus local editor/temp artifacts; no production mutation was executed during this pass.

## Changes

- Split ordinary CI verification from production DB mutation by adding `.github/workflows/ci.yml` and `.github/workflows/db-production.yml`.
- Added a release workflow at `.github/workflows/release.yml` separated from the DB path.
- Removed automatic `supabase db push` paths from `deploy.yml` and added workflow/script mutation-safety tests.
- Added capability-specific guards for prioritized platform routes and closed the legacy membership bootstrap bypass for existing suspended, expired, or revoked records.
- Made web and Pharmacy typography offline-safe with explicit font tokens; added direct Lab Edge `tsx` dependency and Node 22 engine metadata.
- Added executable health/readiness evidence scripts and a gated facility invitation hardening proposal.
- Added a read-only migration history check script: `scripts/check-migration-history.mjs` and root command `npm run db:history:check`.
- Added canonical platform-admin guard audit: `scripts/check-platform-admin-guards.mjs` plus a repo test guarding against the deprecated path.
- Added root verification and health/report scripts to better structure the command surface.
- Added the infrastructure sweep artifact at `docs/engineering/INFRASTRUCTURE_SWEEP_2026-09-10.md`.
- Included the required final report artifact path.

## Security

- The compatibility wrapper remains for migration, but privileged platform routes use the canonical capability-aware result and prioritized routes now specify minimum existing capabilities.
- The canonical capability-aware admin authorization remains `apps/web/src/lib/platform/auth.ts`; workflow and route guard tests fail on regression.
- Tenant and host boundary tests remain the key safety path; direct-ID bypass and spoofed tenant header protections are explicitly recognized as required test gates.
- Production DB mutation requires explicit operator confirmation and is no longer coupled to PR CI.

## Database

- Migration history remains not reconciled; this was documented before changes and not silently “fixed.”
- The new check is read-only and will fail if history or migration structure is invalid or suspicious.
- PENDING migrations remain blocked until a verified production ledger reconciliation is done by an operator.

## CI / CD

- `deploy.yml` no longer contains production DB mutation; only the manual `db-production.yml` workflow contains `supabase db push`.
- Release gating verifies the originating repository, main push event, completed CI `head_sha`, selected SHA checkout, and uploaded evidence.
- This prevents ordinary `push` or `pull_request` from mutating Supabase production.

## Deployment

- Deployment smoke checks remain non-destructive and require evidence; production deployment readiness is still constrained by migration ledger reconciliation and live validation.
- No claim is made that the platform is fully green for production DB or release rollout.

## Admin

- `health-smoke.mjs` now emits bounded probe evidence with `PASS`, `DEGRADED`, `FAILING`, and `NOT_CONFIGURED`; `readiness-report.mjs` consumes evidence and reports `BLOCKED` when prerequisites are unknown.
- Service probes require live evidence before a status can be marked healthy.

## Golden journeys

- Golden journey evidence format and test center flows are now documented as required architecture, but current repo execution remains incomplete without external credentials and full production/tenant proof.
- No false green is asserted.

## Module status

- Clinical: YELLOW / RED pending live journey proof
- Intelligence: YELLOW / advisory
- ICD-11: YELLOW pending production WHO service proof
- Pathways: YELLOW
- Lab: YELLOW / controlled pilot target
- Pharmacy: YELLOW / controlled pilot
- FHIR: YELLOW pending live authenticated tenant roundtrip
- Insurance: YELLOW / advisory
- Exchange: YELLOW / development
- Offline: RED until durable clinical replay proof exists

## Tests

Commands executed or prepared in this pass:

- `git fetch --all --prune`
- `git status --short --branch`
- `npm ci` completed with the repository postinstall compatibility setup.
- `npm run verify` completed: web build, Pharmacy type-check/lint/tests/build, control-plane (43 tests), tenancy (32 tests), and Lab Edge (12 tests).
- `npm run type-check --workspace @synapse/app` and `npm run export:android --workspace @synapse/app` completed successfully.
- `npm run test:workflow-safety`, `node scripts/check-workflow-safety.mjs`, `npm run health:smoke`, and `npm run readiness:report` completed; local readiness is correctly `BLOCKED` because live health, deployment, and remote migration evidence are absent.
- `npm run db:history:check` was added and is the intended read-only guard.
- `npm run test:control-plane` is the repo’s targeted test entrypoint for control-plane coverage.
- `npm run test:tenancy` is the explicit tenant-isolation entry point.
- `npm run test:lab-edge` is the Lab Edge test entrypoint.

## External blockers

- DNS / domain probes and production deployment checks require live environment credentials and domain-config access.
- Vercel production status requires configured API tokens and project context.
- Supabase production migration reconciliation and apply require explicit, operator-controlled access tokens and a reviewed migration ledger.
- EAS cloud artifact publication requires Expo token configuration; local Android export passed.
- Physical Android / printer / WHO API / live integration checks remain manual and blocked by environment availability.

## Regressions

- Focused and full local checks passed after the changes; no production mutation or remote schema change was executed.
- Remote migration reconciliation remains unresolved and explicitly blocked; two historical duplicate-prefix files are documented legacy exceptions.

## Remaining P0

- Safely reconcile the remote migration ledger before accepting any production migration.
- Complete operator-controlled remote migration ledger reconciliation and schema/RLS verification.
- Add request-level route tests with mocked anonymous, low-privilege, authorized, suspended, and expired membership contexts.
- Deploy the additive facility invitation hardening schema before re-enabling staff invitations.

## Next 3 engineering priorities

1. Complete remote migration ledger reconciliation and operator-approved production application workflow.
2. Finish request-level capability authorization tests and facility invitation hardening.
3. Begin clinical integration with longitudinal context, approved guidelines, advisory AI, ICD-11, Lab, Pharmacy, and public-health reporting behind the verified contracts.
