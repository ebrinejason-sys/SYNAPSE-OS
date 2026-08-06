# Platform Control Plane (Phase 4)

Web-only, on `admin.synapseos.tech` (route `/platform`). Extend the existing command centre;
do not rebuild it. Source facts from audit §4.

## A. Facility provisioning (make it transactional & recoverable)
Today `POST /api/platform/hospitals` creates rows with silent `catch {}`, creates the admin auth
user **without a password and no invitation**, and creates **no subscription row**. Target:
1. Validate facility info → 2. slug/domain availability → 3. tenant → 4. facility record →
5. subscription/trial → 6. modules → 7. departments → 8. ward/bed templates (if inpatient) →
9. lab/pharmacy config → 10. **admin via setup-invitation link (never a generated password)** →
11. audit events → 12. **roll back / mark failed** on any required step → 13. progress + errors →
14. safe retry of a failed step.
Implement as an idempotent, step-tracked provisioning record (`provisioning_runs` + per-step status)
so retries resume rather than duplicate.

## B. Test hospital / sandbox
A first-class "Create Test Hospital" that creates a **clearly-marked non-production tenant**
(`tenants.environment = 'sandbox'`, `is_test = true`) with synthetic staff, patients, encounters,
lab orders/results, pharmacy inventory+batches (via `receive_pharmacy_stock`), admissions, referrals,
and synthetic surveillance signals. Actions: start / pause / reset synthetic data / open hospital /
open pharmacy / open patient-app preview / generate test activity / view health / view logs.
**Hard guarantee:** synthetic tenants are filtered out of every real integration egress (DHIS2,
EFRIS, NIRA, SMS/email) at the adapter boundary, and reset/delete is an audited, platform-admin-only
workflow that removes only synthetic-tenant rows.

## C. Support access (extend impersonation safely)
Build on the existing impersonation (`api/platform/impersonate`, `is_impersonation` JWT). Add a
`support_sessions` record with: platform-admin only, explicit facility selection, required
purpose/reason, time-limited expiry, **default read-only**, separate escalation for write, a
persistent visible "Support session" banner, per-entity view/change auditing, an explicit exit
action, and facility-admin visibility of past sessions. **Never** a platform-wide unrestricted
patient browser.

## D. Facility detail
One detail page with: metadata, subscription, modules, staff, departments, wards/beds, patient
volume, encounters, lab volume, pharmacy activity, referrals, claims, storage, last sign-in, last
sync, error rate, jobs, integration status, audit, tickets, flags, environment, custom domain,
test/production classification, data residency, backup status, danger zone. (Fix the current
list-vs-detail table mismatch: read `tenants` consistently.)

## E. Monitoring (real data only)
Replace synthetic sparklines/hardcoded statuses with probes over real logs/tables. Health levels:
`healthy | degraded | failing | unknown | maintenance`. Signals: API uptime, DB latency, auth,
storage, realtime, email, push, payments, EFRIS, DHIS2, ICD service, AI service, queue depth,
failed jobs, offline-sync conflicts, last backup, last migration, app/Expo versions, active users,
session failures, API error rates, slow endpoints, tenant incidents. Add alert acknowledge / assign
/ resolve with audit history. Do not show "Operational" purely because an env var exists.
