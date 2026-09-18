# Production Green report — 2026-09-18

**Status:** CURRENT  
**Starting SHA:** `12a46f825611efeecbf56f03b18a061259a2562c`  
**Branch:** `cursor/production-green-2026-09-18`

**CORE OS GREEN: NO**

Build success is not GREEN. This campaign hardened the production OS, made navigation truthful, and added release/integrity gates. Live browser, live RLS SQL, production SHA alignment, and backup restore remain open.

## Scoreboard

| Gate | Result |
|---|---|
| Broken internal production nav links | **0** (`npm run test:routes` PASS, 72 presented links) |
| Visible placeholders in production nav | **0** (78 ROADMAP pages remain off-nav) |
| Hospital browser journey | **FAIL** (no synthetic `SYNAPSE_E2E_*` target) |
| Tenancy unit/middleware | **PASS** |
| RLS live matrix | **FAIL** (contract tests only; not pgTAP against every critical table) |
| DB ACL static | **PASS** (38 SECURITY DEFINER functions inventoried; 0 PUBLIC/anon EXECUTE grants in SQL). Live DB skipped. |
| FHIR | **YELLOW** — CapabilityStatement advertises Observation, Specimen, DiagnosticReport only |
| ICD-11 | **YELLOW** — cache fallback proven; WHO live not probed here |
| Admin | **YELLOW** — lifecycle API + membership/MFA actions added; migration not applied |
| Backup restore drill | **BLOCKED** |
| Production release gate | **PASS** (Git production deploys skipped; CLI path remains after db-acceptance) |
| Main branch protected | **OPERATOR ACTION** (`docs/operations/MAIN_BRANCH_PROTECTION_REQUIRED.md`) |

## What changed in this campaign

- Canonical facility shell is `/os/[slug]` plus `/hospital/admin`, `/lab`, `/encounter/[id]`.
- One Doctor workspace (`/doctor`) and one Nursing workspace (`/nurse`); stub specialty routes redirected or unlinked.
- `npm run test:routes` fails CI if production nav points at missing, ROADMAP, Demo, or hash hrefs.
- Vercel Git **production** builds are skipped so deploy-first is no longer the normal path.
- FHIR honesty: unproven resources return OperationOutcome 501 and are not advertised.
- ICD-11 survives WHO outage via seed cache.
- Unauthenticated AI soap/history/score stubs now require a session and stay advisory-only.
- Facility lifecycle state machine + API (hard purge synthetic-only).
- Registration best-effort links `persons` / Synapse ID without auto-merge.
- Facility staff deactivate now drops **membership scope**, not the global profile.
- Public `/api/ready` and `/api/health/live` probe the database.

## Domain colours

Identity YELLOW · Tenancy GREEN · Admin YELLOW · Reception YELLOW · Triage YELLOW · Doctor YELLOW · Lab YELLOW · Pharmacy bridge YELLOW · Billing YELLOW · Timeline YELLOW · Referral YELLOW · Offline YELLOW · FHIR YELLOW · ICD11 YELLOW · AI YELLOW · Mobile EXTERNAL_BLOCKED · Observability YELLOW · Backup EXTERNAL_BLOCKED · Security YELLOW · Deployment YELLOW

## Blockers

1. Enable GitHub rulesets on `main` (Pro/Team/org).
2. Provision synthetic E2E tenant and run `scripts/e2e-hospital-browser.mjs`.
3. Run live RLS SQL matrix and `DATABASE_ACL_URL` ACL assertions in an isolated/non-prod DB.
4. Apply `20260918120000_facility_lifecycle_control_plane.sql` via the production DB workflow after dry-run.
5. Execute backup restore drill (`docs/operations/BACKUP_RESTORE.md`).
6. Record production SHA = approved SHA after gated promotion.
