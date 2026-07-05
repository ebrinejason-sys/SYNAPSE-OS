# Hospital Build Phase 2a — Shared Department Infra + Registration & OPD

**Date:** 2026-07-04
**Status:** Approved
**Branch:** `hospital-build/phase-2a-registration-opd` (new branch off `main`, per master-prompt rule: PR-only, never merge directly)
**Parent context:** Cursor's "SYNAPSEOS HOSPITAL BUILD" master prompt, Phase 2 ("Department Workspaces"), sub-phase 2a. Phase 0 (module registry) and Phase 1 (Hospital Admin Console, PR #12) are complete/merged-pending; this is the first Phase 2 sub-phase.

## Context

`docs/hospital-module-map.md` (Phase 0 ground-truth audit) marks most Phase 2 screens "✅ Exists," but a direct read of the actual files shows several are literal placeholder stubs (`/doctor/queue`, `/dept/ae/triage` are both just `<h1>...</h1><p>Coming soon.</p>` with no logic). Registration (`/os/[slug]/patients`) is real but read-only — direct Supabase server-component queries, no API layer, no "register new patient" action. There is no `consult_queue` table; queue state is derived entirely from `encounters.status`. A separate, already-approved spec (`2026-06-09-doctor-consultation-workspace-design.md`) covers the Doctor/Clinical module (`/consults/*`) — that is master-prompt sub-phase 2b's spec, not this one. This spec covers **Registration** and **OPD/Triage** only.

## Scope

**In scope:**
1. Shared department-auth lib (`apps/web/src/lib/hospital-dept/`), parallel to `hospital-admin`, for any authenticated hospital staff member (not just admins).
2. Shared UI primitives: `DepartmentShell`, `PatientSearch`, `usePatientContext`.
3. Registration: add a "Register new patient" form to the existing `/os/[slug]/patients` screen, backed by a new `POST /api/patients/register`.
4. OPD: build real UI at `/dept/opd/queue` (list) and wire triage capture, backed by new `GET /api/opd/queue` and `POST /api/opd/triage`.

**Out of scope (deferred):**
- Patient-merge/dedup workflow (`/api/patients/merge`) — separate later PR, distinct data-integrity risk profile.
- `/doctor/queue` and the full consultation workspace — master-prompt sub-phase 2b, follows the existing approved June 9 spec.
- Any pharmacy POS / `pharmacy_transactions` path — untouched per master-prompt constraint.

## Architecture

### Shared lib: `apps/web/src/lib/hospital-dept/`

- `context.ts` — `requireHospitalStaffContext()`: same cookie→`verifyToken`→`validateSession`→profile-lookup pattern as `requireHospitalAdminContext`, but with **no admin-role allowlist** — any profile with a `tenant_id` and hospital `facility_type` qualifies. Returns the same shape as `HospitalAdminContext` (extract a shared `HospitalContext` base interface so both libs' contexts are structurally compatible).
- Reuses the **existing, already-generic** `requireHospitalCapability(ctx, resource, action, module)` and `gateHospitalModule(tenantId, hospitalId, moduleKey)` from `hospital-admin` — both already take `ctx.role`/`ctx.facilityType` generically and need no changes. To avoid a cross-import from `hospital-dept` back into `hospital-admin`, move these two functions (and the base `HospitalContext` interface) into a new shared `apps/web/src/lib/hospital-shared/` module; both `hospital-admin` and `hospital-dept` import from there. `hospital-admin`'s `requireHospitalAdminContext` keeps its own admin-role check on top.
- `schemas.ts` — zod schemas: `patientRegisterSchema`, `triageSchema`, `opdQueryQuerySchema`.

### New API routes (auth → capability → module-gate → zod → service-role query → audit_log)

Capability triples below are the ones already seeded by `20260704120000_hospital_module_registry_seed.sql` (Phase 0) — routes must use these exact `(module, resource, action)` values, not invented ones, or `has_capability()` returns false for every role.

| Route | Method | `requireHospitalCapability(ctx, resource, action, module)` | Module gate | Behavior |
|---|---|---|---|---|
| `/api/patients/register` | POST | `(ctx, 'patient', 'register', 'registration')` | `registration` | Validates body, inserts into `patients`, audit-logs `INSERT` on `patients`. Granted to `receptionist`. |
| `/api/opd/queue` | GET | `(ctx, 'queue', 'read', 'opd')` | `opd` | Queries `encounters` (today, `status in (open,in_progress,completed)`) joined to `patients`, same derivation `GET /api/mobile/queue` already uses — no new queue table. Granted to `receptionist`. |
| `/api/opd/triage` | POST | `(ctx, 'triage', 'assign', 'opd')` | `opd` | Creates/updates an `encounters` row (type `OPD`) + a `vitals` row for triage vitals/acuity, mirroring `POST /api/encounters`'s existing write shape. Audit-logs `INSERT`/`UPDATE`. Granted to `doctor`. |

Note: `hospital_admin` is **not** granted `opd`/`registration` capabilities (it only holds `config` module grants from Phase 1) — that's intentional, matching the seed. Testing these routes requires a `receptionist`/`doctor`/`nurse`/`clinical_officer` profile, or `platform_admin` (which bypasses all capability checks).

### UI

- `apps/web/src/components/hospital-dept/DepartmentShell.tsx` — layout: patient banner (top), queue panel (left/collapsible), workspace slot (children).
- `apps/web/src/components/hospital-dept/PatientSearch.tsx` — search by name/MRN, calls `patients` table (same query shape as the existing `/os/[slug]/patients` search).
- `apps/web/src/hooks/usePatientContext.ts` — client hook holding the selected patient for a department session.
- `apps/web/src/app/dept/opd/queue/page.tsx` (new) — uses `DepartmentShell` + `PatientSearch`, lists today's OPD queue via `GET /api/opd/queue`, opens a triage panel that POSTs to `/api/opd/triage`.
- `apps/web/src/app/os/[slug]/patients/page.tsx` (modified) — add a "Register patient" button/form calling `POST /api/patients/register`; existing read-only list/search behavior unchanged.

## Data flow

Registration: form submit → `POST /api/patients/register` → insert `patients` row → audit log → redirect/refresh list.

OPD: page load → `GET /api/opd/queue` → render queue → clinician selects patient → triage form → `POST /api/opd/triage` → creates `encounters`+`vitals` rows → audit log → queue refreshes (re-fetch, no live socket).

## Error handling

- All new routes return capability/module-gate 403s exactly like Phase 1's admin routes (reuse the same `isContextError`/`CapabilityError` patterns).
- Zod validation failures return `{ error: parsed.error.flatten() }`, status 400, consistent with existing routes.
- Supabase write errors return `{ error: error.message }`, status 500.

## Testing

- Type-check (`apps/web` via `npm run type-check`) and `npm run verify:web` (production build) after implementation, matching Phase 1's verification gate.
- No new tables, no synthetic transactional data — module ships FLAG-OFF (`opd`/`registration` module toggles default inactive, per Phase 0 registry).

## Out of scope for this spec (confirmed)

- Patient-merge/dedup.
- Doctor/Clinical consultation workspace (`/consults/*`) — sub-phase 2b, uses the existing approved 2026-06-09 spec.
- Any change to `/doctor/queue`, pharmacy POS, or `apps/pharmacy`.
