# Tenant isolation and onboarding verification (2026-09-05)

The production onboarding path now enforces single-facility staff scope at invite redemption. A facility invitation is bound to its provisioned `tenant_id`; redemption rejects profiles or active scope assignments belonging to another tenant and creates an active `staff_scope_assignments` row for the invited role. The `/os/[slug]` shell resolves the slug server-side and requires the authenticated profile or active scope to match that tenant. Platform roles do not receive implicit access to hospital clinical PHI; only the existing scoped non-hospital control-plane bypass remains.

Provisioning still owns tenant lifecycle: tenants remain `status=provisioning` and `is_active=false` until the finalize step, and failed runs leave tenants inactive. Invite redemption only completes account credentials and never activates a tenant. Provision run and invitation status, including safe step failures, remain available in the platform facility detail view.

Verification:

- With Supabase configured: `npm run test --workspace @synapse/web` and `npm run test --workspace @synapse/pharmacy`.
- Run type checks: `npm run type-check --workspace @synapse/web && npm run type-check --workspace @synapse/pharmacy`.
- Manual: provision facility A, redeem its invite, sign in, and verify `/os/<facility-A-slug>` works while `/os/<facility-B-slug>` redirects with `facility-access`. Confirm the staff profile has one active tenant scope and that cross-facility patient, encounter, order, task, and billing reads return no data/403 under RLS.

External operator blockers remain unchanged: configure the `*.synapseos.tech` wildcard in Vercel/DNS and attach the pharmacy domain. These are not code changes and are not represented as production subdomain proof here.

# Facility Onboarding Production Report (2026)

## Root cause

`public.departments` had global unique index `idx_departments_name_unique` on `lower(name)`.

That blocked Hospital A and Hospital B from both having departments named Laboratory / Pharmacy / Billing.

Failed runs:

| Slug | Failure |
|---|---|
| `ebrinetest` | `DEPARTMENT_INSERT` / global unique |
| `synapse-integrated-demo` | `DEPARTMENT_INSERT` / global unique |

Both had already created tenant + hospital + modules before failing. They were incorrectly left `active`/`is_active=true` by the old provisioner.

## Migration

`supabase/migrations/20260903120000_departments_tenant_scoped_unique.sql` (applied to SYNAPSE_OS):

- DROP `idx_departments_name_unique`
- ADD `idx_departments_tenant_name_unique` `(tenant_id, lower(name)) WHERE tenant_id IS NOT NULL`
- ADD `idx_departments_global_name_unique` `(lower(name)) WHERE tenant_id IS NULL`

## Repair

- Marked failed tenants inactive during repair window
- Inserted missing tenant-scoped departments (cross-tenant Laboratory proven)
- Completed provisioning runs → `COMPLETE`
- Restored tenants → `active` / `is_active=true`
- Created secure invitations for admins

Evidence:

- `ebrinetest`: 7 departments, ACTIVE
- `synapse-integrated-demo`: 13 departments, ACTIVE
- Both tenants have Laboratory (and Pharmacy) department names without collision

## Lifecycle fix

Provisioner now creates tenants as `provisioning` / inactive until finalize. Failures stay failed/inactive. `resumeFacilityProvision` retries without duplicating tenant/hospital/modules/invites.

## Platform surface

- `/platform/facilities` list + filters
- `/platform/facilities/new` create wizard (hospital/clinic/pharmacy/lab)
- `/platform/facilities/[id]` detail + resume
- Clear failure UI: step / code / reason / correlation ID / Retry
- Pharmacy API uses secure invites (no password email)

## Domain / Vercel blockers (honest)

| Check | Result |
|---|---|
| OS production READY at main `e348dbb` (pre-push) | PASS (will re-verify after this push) |
| `*.synapseos.tech` on `synpase-os` | **FAIL / NOT CONFIGURED** |
| `domain-test.synapseos.tech` proof | **BLOCKED** until wildcard DNS+Vercel |
| Synapse Pharm latest production | **CANCELED** on recent main SHAs; last READY lags main |
| `pharm.synapseos.tech` on Pharm project domains list | **NOT present** in project domain list via API |

Required operator actions:

1. Add `*.synapseos.tech` to Vercel project `synpase-os` + DNS wildcard
2. Ensure `pharm.synapseos.tech` is attached to `synapse-pharm` (or intentional OS reverse-proxy) and redeploy READY matching main
3. Prove `domain-test.synapseos.tech` end-to-end

## Tests

- Catalog unit tests: hospital + facility + department uniqueness contracts — PASS
- Test Center modules added: facility / hospital / pharmacy / laboratory / domain-routing
- Domain wildcard test intentionally **FAIL** until configured (SKIPPED ≠ PASS)

## Remaining blockers

1. Wildcard tenant ingress not configured on Vercel/DNS
2. Synapse Pharm production SHA not current READY
3. Live UI acceptance of new Hospital/Pharmacy/Lab creates still required on `admin.synapseos.tech` after deploy
