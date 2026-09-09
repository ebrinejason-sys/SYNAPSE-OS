# SYNAPSE OS Functionality Audit 2026

Date: 2026-09-09
Baseline: `c1d9a65f859ec762a15bba28905d6b3dcc18aa0e`
Scope: source-controlled application routes, APIs, packages, migrations, and existing tests. Generated `.next` output and documentation-only examples are excluded.

## Repository Truth

- `HEAD` and `origin/main` are aligned at the baseline SHA.
- Local untracked `.vscode/settings.json` and `supabase/.temp/` were present before this audit and were not modified.
- The web application contains 480 `page.tsx`/`route.ts` entrypoints; 133 are in the OS, hospital, Lab, pharmacy, nurse, doctor, Platform, onboarding, or referral surfaces.
- Supabase contains 77 migration files.
- The latest commit is a real implementation milestone: it includes durable clinical closure/handoff code, Lab report release code, Lab Edge protocol/queue tests, analyzer golden tests, and tenant/RBAC tests.
- No `docs/readiness/` directory existed before this audit.

## Status Vocabulary

GREEN means durable behavior, authorization, and an executable proof are all present. YELLOW means meaningful implementation exists but proof or an important edge is missing. RED means broken or unsafe. STUB means an active route intentionally renders a placeholder. DEAD, DUPLICATE, LEGACY, and UNSAFE require a route-level review before release. UNTESTED means the source suggests behavior but this audit did not find an executable acceptance proof.

## Initial Route Inventory

| Surface | Representative routes | Status | Evidence / gap |
|---|---|---|---|
| Facility OS shell | `/os/[slug]`, dashboard, patients, clinical queue/tasks/orders/nursing | YELLOW | Authenticated tenant shell and durable APIs exist; complete reload-to-reload golden journey is not yet proven. |
| Registration and identity | `/os/[slug]/patients`, registration form, identity hooks | YELLOW | Registration exists; duplicate prevention and external-ID crosswalk behavior need journey evidence. |
| Encounter entry | `/os/[slug]/encounters/new`, `/api/opd/triage` | YELLOW | Complaint and core vitals persist. Current page does not yet expose complete structured clinical write-up. |
| Clinical documentation | `/encounter/[id]/history`, `/notes`, `/sign`, `/api/opd/encounters/*` | YELLOW | Separate surfaces and closure/versioning primitives exist; field-by-field HPI, PMH, ROS, examination, plan, and signed-note proof is incomplete. |
| Nursing and ward | `/nurse/*`, `/hospital/admin/wards`, `/hospital/admin/beds` | YELLOW | Ward, beds, observations, MAR, and handover surfaces exist; admission -> transfer -> round -> discharge lifecycle needs acceptance evidence. |
| Lab worklist | `/lab/orders`, `/api/lab/worklist`, `/api/lab/actions` | YELLOW | Collection, receipt, result entry, verification, and referral entry are represented; catalogue, specimen rejection/recollection, pricing, and report proof need a full Lab golden run. |
| Lab verification/reporting | `/lab/verify`, `/lab/results`, `/lab/reports`, report APIs | YELLOW | Human verify/release boundary and immutable release design exist; amendment, critical acknowledgement, printable report, TAT, and reload proof remain unestablished. |
| Lab Edge | `apps/lab-edge/src/*` | YELLOW | SQLite queue, raw messages, retry/transport/protocol tests and analyzer golden test exist; real device validation and end-to-end cloud acceptance remain untested. |
| Pharmacy bridge | `/pharmacy/*`, hospital dispense APIs, `apps/pharmacy` | YELLOW | Mature Pharm app and hospital dispense path exist; OS golden journey must prove authoritative decrement, event/timeline, billing, and idempotency together. |
| Billing and disposition | hospital billing/payment and closure APIs | YELLOW | Payment, closure, and disposition primitives exist; actual-service billing policy and non-revenue paths need evidence. |
| Referrals | `/referrals/*` | STUB | Current referral pages include explicit `Coming soon` output; APIs and active navigation require classification and canonical replacement. |
| Platform command center | `/platform`, Test Center, facilities, subscriptions, Lab monitor, deployments, health | YELLOW | Broad real admin surface and production truth helpers exist; information architecture is still a large multi-section shell and readiness evidence is not unified. |
| Platform PHI boundary | platform auth, tenant scope, isolation tests | GREEN for tested boundary | Existing tests explicitly keep platform admins out of hospital PHI and reject host/path tenant mismatch. Coverage must be expanded to changed domain resources. |
| eAFYA parity | patient, appointment, theatre, ICU, immunization surfaces | UNTESTED | Routes exist in several areas, but no field-by-field parity matrix existed at audit start. |
| ALIS parity | Lab configuration, worklist, reports, equipment, inventory | UNTESTED | Lab foundations exist, but ALIS capability coverage was not previously recorded as an acceptance matrix. |

## Active Placeholder Inventory

The following source routes contain explicit `Coming soon` output and must not be treated as implemented production workflows:

- `/admin/supply/orders`
- `/imid/[code]`
- `/onboarding/billing`
- `/onboarding/departments`
- `/onboarding/guidelines`
- `/onboarding/insurance`
- `/onboarding/pharmacy`
- `/onboarding/staff`
- `/pharmacy/expiry`
- `/pharmacy/nms`
- `/pharmacy/reports`
- `/referrals`
- `/referrals/[id]`
- `/referrals/incoming`
- `/referrals/new`
- `/referrals/outgoing`
- `/scores`
- `/scores/[code]`
- `/scores/[code]/trend`
- `/sdg`
- `/sdg/goal/[number]`
- `/sdg/reports`

These are an inventory, not a deletion list. Each route needs an owner decision: implement, hide from critical navigation, or clearly mark as non-production.

## Highest-Value Findings

1. The current encounter entry is narrower than the required clinical write-up. It captures chief complaint and a limited vital set, then posts through the triage API. It does not demonstrate structured HPI, PMH, drug history, allergies/reactions, family/social history, ROS, system examination, problem list/differential/confirmed diagnosis, plan, or signed versioned note in one workspace.
2. Existing Lab and Edge code is substantive, but page existence is not a Lab golden proof. The release path must prove specimen lifecycle, result versioning, report generation, FHIR output, and negative cases in a durable test environment.
3. Platform Admin already has the requested concepts. The remaining work is consolidation and evidence: facility readiness, deployment SHA comparison, migration state, subscriptions, network Lab/Pharm health, security, and Test Center results need a coherent readiness model.
4. Placeholder counts from broad repository search are not reliable because generated `.next` artifacts and normal form placeholders are present. Future sweeps must exclude build output and classify each source hit.

## Wave 0 Acceptance Gaps

- Create and maintain the eAFYA and ALIS matrices.
- Add a functionality scorecard with CODE, DATABASE, RBAC, RLS, UI, API, PERSISTENCE, LIVE_PROOF, parity, STATUS, and BLOCKER columns.
- Establish executable HOSPITAL_GOLDEN, LAB_GOLDEN, ANALYZER_GOLDEN, PLATFORM_GOLDEN, and negative tenant/RBAC suites on the current main SHA.
- Validate production migration/deployment SHA alignment before claiming pilot readiness.

## CONTROL PLANE BASELINE

Validated on the current working tree after the provisioning repairs:

- Control-plane suite: PASS, 3 files / 41 tests.
- Provisioning contract: PASS, 10 tests, including hospital, clinic, laboratory, pharmacy retry, domain record, reserved slug, and tenant isolation behavior.
- Focused control-plane security: PASS, 7/7.
- Lab Edge: PASS, 12/12.
- Web typecheck: PASS.
- Web lint: PASS.
- Web production build: PASS; Next generated 288 pages.
- `git diff --check`: PASS.
- Database package: provisioning/domain tests pass under the focused Vitest run. The broad native Node TAP sweep is not a valid repository-wide gate because 11 files use extensionless imports that fail under direct Node resolution (`exchange`, `canonical`, and related package imports). No DB package test script exists.
- Remote migration state, live synthetic acceptance, GitHub/Vercel SHA alignment, and production deployment health were not claimed by this local run.

The previous six control-plane failures are closed. Wave 0 is ready for commit only after final git review and remote alignment verification.

## Canonical Destinations to Protect

- Hospital care spine: patient -> visit/queue -> encounter -> orders -> Lab result -> treatment -> Pharm -> billing -> disposition -> timeline.
- Laboratory: order -> accession -> specimen -> worklist -> result staging -> human verification -> release -> report/interoperability.
- Platform: `/platform` as command center; existing facilities, Test Center, Lab, deployment, subscription, security, and health pages remain drilldowns rather than parallel admin products.
