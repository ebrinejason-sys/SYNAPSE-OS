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
