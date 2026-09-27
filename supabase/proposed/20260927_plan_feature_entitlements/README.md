# PROPOSED: plan feature entitlements (not auto-applied)

Status: **proposed seed**. Lives under `supabase/proposed/` so `supabase db push`
and the migration runner never apply it. A human applies it to production.

## Root cause
Hospital OS routes call `gateHospitalModule(tenant, hospital, module)`, which
requires `hospital_modules.is_active` **and** `has_feature(tenant, feature_key)`
(feature key taken from `platform_billing_config.hospital_module_registry`).
`has_feature` resolves `tenant_feature_overrides`, else the tenant's single
`tenant_subscriptions` row (UNIQUE tenant_id) → `plan_features`.
The current commercial plans (`synapse_os_basic_annual`, `synapse_lab_annual`,
`synapse_os_lab_addon_annual`) were created with **zero** `plan_features`, so
every gated hospital/lab module returned 402 for subscribed tenants.

## Approved mapping (2026-09-27)
| Plan slug | Features |
|---|---|
| `synapse_os_basic_annual` (OS Basic) | registration, opd, billing, reports |
| `synapse_os_lab_addon_annual` (OS + Lab) | OS Basic + lab |
| `synapse_lab_annual` (Standalone Lab) | lab, registration, billing, reports |
| `synapse_pharmacy_annual` | unchanged (already seeded) |
| `synapse_enterprise`, custom, legacy `hospital_*` | intentionally empty |

### OS + Lab representation
There is no combined `synapse_os_lab` plan key, and `tenant_subscriptions`
allows exactly one row per tenant, so an add-on cannot be a second
subscription. The add-on plan row therefore carries the full OS Basic + lab
entitlement set, and an OS + Lab facility is represented by pointing its single
subscription at `synapse_os_lab_addon_annual`. Its `price_ugx` (500 000) is the
add-on delta; invoicing must charge OS Basic + add-on. If product later wants
stacked subscriptions, `has_feature` and the UNIQUE constraint must change first.

## Apply / verify / rollback
```sql
\i up.sql      -- idempotent; re-running inserts 0 rows
select sp.slug, string_agg(pf.feature_key, ',' order by pf.feature_key)
  from subscription_plans sp join plan_features pf on pf.plan_id = sp.id
 where sp.slug like 'synapse_%' group by 1;
\i down.sql    -- removes exactly the seeded pairs
```
`up.sql` also inserts the module registry **only if missing** (production
already has the identical value; schema-only environments do not).

## Not included (production actions, human-approved)
Tenant plan reassignment is deliberately **not** part of this seed. See the
release report for the per-tenant list.
