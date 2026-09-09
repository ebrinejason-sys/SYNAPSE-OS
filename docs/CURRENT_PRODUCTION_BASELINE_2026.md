# SYNAPSE OS Current Production Baseline

**Recorded:** 2026-09-03
**Repository:** `ebrinejason-sys/SYNAPSE-OS`
**Local branch:** `main`
**Local HEAD:** `2bf666cad4410a7bdeec8603597fcb63d67771a6`
**`origin/main`:** `2bf666cad4410a7bdeec8603597fcb63d67771a6`

## Evidence

| Component | Status | Evidence |
|---|---|---|
| Repository main sync | READY | Local `main` matches `origin/main` at `2bf666c`. |
| Synapse OS deployment | NOT_CONFIGURED | Deployment CLI status could not identify a ready deployment; production SHA not verified. |
| Synapse Pharm deployment | PARTIAL | The Pharmacy Vercel ignore gate was removed. Local production build passes, but production deployment SHA/state is not verified. |
| Vercel project state | PARTIAL | Repository deployment status script returned `UNKNOWN` for configured projects. |
| Supabase migrations | PARTIAL | Latest GitHub verification reported local migration checks as passing; remote migration state was not queried. |
| Main CI | FAILED | Run `33740188645`; web build and migration checks passed, Pharmacy verification failed. |
| Wildcard tenant domain | NOT_CONFIGURED | DNS and Vercel wildcard assignment were not verified. |
| Canonical Pharm domain | NOT_CONFIGURED | `pharm.synapseos.tech` assignment and certificate were not verified. |
| Facility provisioning foundation | PARTIAL | Shared catalog, orchestrator, run/step tables, invitations, and documented routes exist. Live onboarding evidence is absent. |
| Tenant header boundary | READY | Web middleware now strips inbound `x-tenant-id`, `x-tenant-domain`, and `x-tenant-slug` before forwarding API/static requests; web type-check passes. |

## Current blockers

1. Identify and repair the failing Pharmacy verification step in CI run `33740188645`.
2. Verify OS and Pharm Vercel deployment states and deployed SHAs with authenticated project access.
3. Verify Supabase remote migration state.
4. Configure and prove wildcard DNS and the reserved `pharm` host.
5. Execute synthetic Hospital, Pharmacy, and Laboratory onboarding through Platform Admin and store Test Center evidence.
6. Complete the Lab and analyzer golden journeys before declaring pilot readiness.

## Scope note

This baseline records verified repository and local validation facts only. Source code presence is not treated as production readiness.
