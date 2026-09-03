# Hospital Onboarding — Production Report (2026-09-02)

## Verdict

Hospital onboarding is rebuilt for explicit provisioning state, canonical modules, ownership/level separation, invite redemption, Test Center suite, and facility detail observability.

**Deploy unblocked (2026-09-02):** Owner-authored commits (`ebrinejason-sys <ebrinejason@gmail.com>`) cleared the Vercel collaboration BLOCKED gate. Production `synpase-os` is **READY** at SHA `e348dbb937438d33e4a87d99d65c1b92a5bb240a` (matches GitHub `main`). Schema for provisioning was applied to SYNAPSE_OS. Next live step: create SYNAPSE INTEGRATED REGIONAL HOSPITAL via the wizard.

## 1. Deployment truth

| Surface | Value |
|---|---|
| GitHub `main` (local HEAD before this work) | `23038701b24472ea927502e5a5ed93692baa7aae` |
| Latest Vercel production attempt (`synpase-os`) | `BLOCKED` @ `2303870…` |
| Commit author on blocked deploys | `Synapse Agent <agent@synapse.local>` · `githubCommitVerification: unverified` |
| Last **READY** production | `d99cbfd36fa2dab62ac538ed7f5a3353ec8410f6` (older than clinical/billing/DHIS2) |
| Control plane | `admin.synapseos.tech` → Platform Control Center SHA cards |

**Root cause:** Vercel project collaboration / account-configuration block on unverified agent commit identity — **not** an application code defect. Do not workaround in product code.

**Required fix:** Push/merge with repository-owner identity (e.g. `ebrinejason@gmail.com` / authorized GitHub user) or PR → merge under that account. Prefer new commits; do not rewrite history.

**Control Center:** `apps/web/src/lib/platform/production-truth.ts` now surfaces BLOCKED + author email in deployment detail. Overview cards already compare GitHub main vs production SHA.

## 2. Prior onboarding path (audit)

Before this milestone:

1. Wizard `POST /api/platform/hospitals` created tenant + hospital, then **silently** `console.error`’d module/department/subscription failures.
2. Module keys were legacy (`doctor`, `laboratory`, …) and did not unlock canonical gates (`clinical`, `lab`, …).
3. Ownership collapsed into hospital `type` incorrectly.
4. Admin auth used temp-password email instead of single-use setup invite.
5. Facility detail required fragile legacy assumptions; no provisioning run visibility.
6. In-memory seed (`hospital-seed.ts`) existed but was not the durable Platform Admin path.

## 3. Code fixes

| Area | Change |
|---|---|
| Provisioner | `packages/db/src/hospital-provision.ts` — step-audited, idempotent, REAL \| SYNTHETIC_ACCEPTANCE |
| Catalog | `packages/db/src/hospital-provision-catalog.ts` — ownership, levels, canonical modules, legacy key map |
| API | `apps/web/src/app/api/platform/hospitals/route.ts` — provision + slug check + run detail + resend invite |
| Wizard | `apps/web/src/app/platform/hospitals/new/page.tsx` — 7 steps, validation, slug debounce, visible progress, no `alert()` primary UX |
| Invite | `/invite/facility/[token]` + redeem API; Resend uses setup link (not permanent password) |
| Detail | `hospitals/[id]/page.tsx` — tenant-authoritative; provisioning steps; invite; departments; Continue onboarding |
| Test Center | Module `hospital-onboarding` + `POST /api/platform/test-center/hospital-onboarding` |
| Email | `sendHospitalStaffInviteEmail` supports `inviteUrl` |

## 4. DB changes

Migrations (applied to SYNAPSE_OS via Supabase MCP):

- `20260901180000_hospital_onboarding_tables.sql` — `hospitals`, `hospital_modules`, department columns, lead insert policy
- `20260902120000_facility_provisioning_runs.sql` — `facility_provisioning_runs`, `facility_provisioning_steps`, `facility_invitations`, `facility_locations`

### Provisioning state model

**Run:** `PENDING` → `RUNNING` → `COMPLETE` \| `READY_WITH_WARNINGS` \| `FAILED` \| `ROLLED_BACK`  
**Mode:** `REAL` \| `SYNTHETIC_ACCEPTANCE`  
**Steps:** validate, core_tenant, facility_profile, modules, departments, locations, subscription, administrator, invitation, synthetic_staff, synthetic_guards, finalize  

Each step records: status, started/completed, error_code, safe_error_message, attempt_count, evidence.

Idempotency key: `hospital:{mode}:{slug}:{adminEmail}` — COMPLETE runs return without duplicates.

## 5. Unresponsive wizard — root cause

Continue felt “dead” because:

1. Weak client validation → invalid posts / silent server failures.
2. Secondary provisioning failures swallowed (`catch {}` / `console.error` only).
3. No loading / step status UI while network ran.
4. Missing tables in some environments → opaque failures.

Fixed with per-step validation, inline errors, disabled duplicate submit, and explicit provisioning progress text.

## 6. Tests

| Suite | Result |
|---|---|
| `hospital-provision-catalog.test.ts` | **5/5 PASS** (module map, regional defaults, slugify, ownership/level enums, clinic vs regional) |
| Test Center HOSPITAL ONBOARDING | Implemented (DB evidence after synthetic provision) |

Still needed after deploy: API integration tests (duplicate slug, idempotent retry, partial failure, invite retry, cross-tenant) in CI with service role.

## 7. Live evidence (this session)

| Check | Evidence |
|---|---|
| Vercel BLOCKED | `dpl_5n383x…` state BLOCKED, author `agent@synapse.local`, SHA `2303870…` |
| Last READY | `dpl_9w1KQR…` SHA `d99cbfd…` |
| Schema present | `hospitals`, `hospital_modules`, `facility_provisioning_*`, `facility_invitations`, `facility_locations` |
| Synthetic tenant | **Not created yet** (awaiting authorized deploy + Platform Admin wizard / provisioner run) |

## 8. Screens / routes

- `/platform/hospitals/new` — Create Hospital wizard  
- `/platform/hospitals/[id]` — facility detail + provisioning  
- `/platform/hospitals` — facilities list  
- `/platform/test-center` — Hospital Onboarding suite + malaria golden  
- `/invite/facility/[token]` — admin password setup  
- `/platform` — production SHA / deploy truth cards  
- `/api/platform/hospitals` — GET slug/modules/run · POST provision / resend_invite  

## 9. Remaining blockers

1. **Deploy unblock** — commit/push onboarding + DHIS2 Phase 2 with **accepted author identity** (not `agent@synapse.local`); confirm `admin.synapseos.tech` serves matching SHA.
2. **Create** `SYNAPSE INTEGRATED REGIONAL HOSPITAL` (`synapse-integrated-demo`, `SYNTHETIC_ACCEPTANCE`) via wizard after deploy; re-run Test Center suite.
3. **Staff login + RBAC** — redeem invites / synthetic staff; malaria journey as Reception → … → Billing (not Platform Admin).
4. **CI hardening** — wire onboarding security tests so they never silently skip.

## 10. Success criteria status

| Criterion | Status |
|---|---|
| Wizard completes with visible provisioning | Code ready · **blocked on deploy** |
| No silent provisioning errors | **Done in code** |
| Provisioning report | **Done** |
| Facility detail works without legacy row requirement | **Done** |
| Invitation setup link | **Done** |
| Synthetic staff / RBAC / malaria live | **Pending deploy + provision** |
| Test Center PASS/FAIL evidence | **Suite ready** · full PASS after provision |
| GitHub main SHA == production SHA | **FAIL** (BLOCKED) |

## Operator next step

```bash
# From a machine / env with authorized Git identity (repo owner):
git commit …   # do NOT use agent@synapse.local
git push origin main
# Confirm Vercel READY, then on admin.synapseos.tech:
# Create Hospital → Create synthetic acceptance hospital → Test Center → Run Hospital Onboarding
```
