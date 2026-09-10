# SYNAPSE-OS Infrastructure Sweep 2026-09-10

## Baseline

- Repository: `ebrinejason-sys/SYNAPSE-OS`
- Branch: `main`
- Starting SHA: `e624986279ad8a5d26e14f838b1eff3a1003f3e9`
- Verified locally: `git fetch --all --prune` completed successfully; working tree at this branch is otherwise clean aside from local editor temp files.

## Repository topology

- Root package manager: npm workspaces
- Workspace packages: `apps/web`, `apps/pharmacy`, `apps/app`, `packages/*`
- Runtime apps: `apps/web`, `apps/pharmacy`, `apps/app`
- Lab Edge app: `apps/lab-edge` is present but not included in the root workspaces and depends on `tsx` without an explicit repo-level install contract.
- Canonical infra code: `packages/config`, `packages/db`, `packages/auth`, `packages/email`, `packages/interop`, `packages/ui`
- Supabase project reference observed in repo config: `qfqakzmjatszisuqjwon`
- Root workflow files: `.github/workflows/deploy.yml` and `.github/workflows/eas-android-preview.yml`

## Discovered infrastructure

- CI: single workflow currently mixes verification and live production mutation (`supabase db push`) on `main`.
- Production DB: Supabase project is configured in docs and scripts; migration history is known to be divergent from local ledger.
- Platform admin: canonical capability-aware access exists in `apps/web/src/lib/platform/auth.ts`; a deprecated `require-admin-api.ts` uses the old binary `hasPlatformAdminAccess()` path.
- Provisioning: facility/hospital provisioning contracts and tests exist in `packages/db` and web routes, but facility invitation semantics remain unsafe and misaligned with the intended professional identity model.
- Control-plane: platform auth and RBAC are implemented, but important routes still use legacy access and several operations rely on configured env presence rather than live verification.
- Lab Edge: exists and has tests, but is not in the root workspaces. This makes a clean-clone install non-reproducible if `tsx` is not available in the environment.
- Production safety gates: migration proof and evidence gating remain incomplete; the repo contains a documented history reconciliation status and pending migrations without a clean remote ledger match.

## Canonical implementations

- Platform authorization: `apps/web/src/lib/platform/auth.ts` plus `membership.server.ts` and `rbac.ts`
- Middleware and tenant isolation: `apps/web/src/middleware.ts` and `apps/web/src/lib/tenant-routing.*`
- Provisioning domain: `packages/db/src/facility-provision*` and related provisioning packages
- Lab Edge protocol + parse pipeline: `apps/lab-edge/src/*`
- Pharmacy control-level tenancy and inventory logic: `apps/pharmacy` and `packages/db`

## Duplicated or conflicting implementations

- Deprecated binary authorization guard: `apps/web/src/lib/platform/require-admin-api.ts`
- Platform routes mixing canonical and legacy access patterns
- Multiple platform API imports of `requirePlatformAdminApi` from different modules instead of a single canonical path
- Historical migration names/timestamps appear divergent between remote and local repository ledger; exact mapping is not yet proven
- Potential admin health checks rely on configured tokens/keys as a proxy for service health, which duplicates a health semantics problem

## Dead / legacy infrastructure

- Legacy Vite demo remains quarantined under `legacy/vite-demo` and should remain outside production build/test paths.
- Stale `/platform` and route aliases that are not canonical should be treated as legacy compatibility only.
- Historical migration ledger drift is a form of dead/uncertain infrastructure unless safely reconciled.

## STOP-SHIP findings

- Production migration workflow is triggered automatically on `main` by `.github/workflows/deploy.yml` without a separate release gate.
- Migration history reconciliation is not proven, but the repo documents a known drift and pending remote-only ledger entries.
- A deprecated admin authorization implementation remains in use and should be removed from privileged API routes.
- Platform admin health status can report healthy based on configuration alone instead of actual service results.
- Lab Edge is not part of the root monorepo workspace contract; clean-clone install is not reproducible.

## P0 / P1 / P2 findings

### P0

- Separate CI from production mutation.
- Read-only migration forensic tooling and `db:history:check` guard.
- Canonical platform-admin authorization path.
- Facility staff invitation hardening.
- Tenant isolation test suite and direct-ID attack coverage.
- Reproducible monorepo install for Lab Edge.
- Truthful health semantics.

### P1

- Liveness/readiness endpoints, correlation IDs, and structured logging.
- Trustworthy audit semantics and API auth matrix.
- Golden journey evidence format and test center surfaces.
- Evidence-based capability gate promotion.
- Dependency audit remediation and Vercel settings review.

### P2

- Legacy code hygiene and decommission plan.
- Host/domain and reserved slug checks.
- Additional documentation cleanup and stale PR triage (not yet executed in repo scope beyond current local path).

## Proposed changes

1. Split CI verification from production DB mutation with separate workflows.
2. Add migration forensic tools and a read-only `db:history:check` gate.
3. Remove deprecated admin authorization usage and use `requirePlatformAdminApi` with capability checks.
4. Add/extend tests for tenancy isolation, platform admin guard usage, and Lab Edge install contract.
5. Fix repo-level installer contract by adding `apps/lab-edge` to workspaces or else isolating it with a deterministic manifest.
6. Add truthful health semantics to admin monitoring, separate configured vs healthy.
7. Keep all production mutation behind an explicit operator-controlled workflow and gated environment.

## Files expected to change

- `.github/workflows/*.yml`
- `package.json`
- `apps/lab-edge/package.json`
- `apps/web/src/lib/platform/auth.ts`
- `apps/web/src/lib/platform/require-admin-api.ts`
- `apps/web/src/app/api/platform/**`
- `apps/web/src/lib/**/*.test.ts`
- `scripts/check-supabase-migrations.mjs`
- `scripts/check-platform-admin-guards.mjs`
- `docs/readiness/**`
- `docs/engineering/**`

## Migrations required

- No new schema migrations should be added during this infrastructure wave until the migration history gate is resolved.
- Existing pending migrations remain `PENDING_NEW` rather than being applied automatically.

## Migrations blocked by migration-history reconciliation

- `20260908120000_lab_reports_release_artifacts`
- `20260909100000_manual_subscription_grants`
- `20260909130000_scope_pharmacy_receipts_to_tenant`
- Any historical remote-only migration lacking a proven local trace and normalized SQL verification.

## External configuration required

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ACCESS_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SYNAPSE_JWT_SECRET`
- Vercel deployment credentials and project IDs for release verification
- EAS/Expo token for preview builds
- GitHub metadata access for health probes

## Acceptance tests

- `npm ci`
- `npm run db:check`
- `npm run verify:web`
- `npm run verify:pharmacy`
- `npm run test:control-plane`
- `npm run test:tenancy`
- `npm run test:lab-edge`
- `npm run db:history:check` (post-implementation)
- `npm run health:smoke` (post-implementation)

## Decision

This repo is not release-green for production DB mutation or full pilot readiness. The highest-confidence safe change set is the separation of CI from mutation plus canonical admin authorization and reproducible environment contracts.
