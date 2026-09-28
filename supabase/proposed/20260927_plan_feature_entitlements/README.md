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
| `synapse_os_basic_annual` (OS Basic) | registration, opd, dispensing, billing, reports |
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

## Provisioning
New facilities no longer subscribe to empty `hospital_*` shells.
`commercialPlanSlug()` selects:

- hospital / clinic → `synapse_os_basic_annual`
- hospital / clinic with `includeLab` → `synapse_os_lab_addon_annual`
- standalone laboratory → `synapse_lab_annual`
- pharmacy → `synapse_pharmacy_annual` (features already in the commercial migration)
- hospital enterprise tier → `synapse_enterprise` (no invented module set)

This code change does not write production rows. Existing tenants keep their
current `tenant_subscriptions.plan_id` until a human applies this seed and
decides any reassignment.

## Not included (production actions, human-approved)
Tenant plan reassignment is deliberately **not** part of this seed.
`dispensing` on OS Basic is the hospital prescription handoff (receive, dispense,
stock decrement, charge capture). It does not grant standalone Pharmacy keys
(`pos.sell`, purchasing, suppliers, Tally, pharmacy network).

Outpatient triage and vitals use the `opd` feature (`POST /api/opd/triage`).
`POST /api/nurse/vitals` stays on `ipd` because that route is ward observation.

IPD, radiology, maternity, theatre, emergency and claims stay ungranted.

## Legacy hospital plans (plan only — do not run)

Slugs still in the catalog, with zero `plan_features` by design:

| Legacy slug | Commercial equivalent | Action |
|---|---|---|
| `hospital_starter` | `synapse_os_basic_annual` | human reassignment |
| `hospital_professional` | `synapse_os_basic_annual`, or `synapse_os_lab_addon_annual` if that tenant's lab module is contracted | human, per tenant |
| `hospital_enterprise` | `synapse_enterprise` (still empty until a custom quote) | human |

Production inventory (read-only, 2026-09-28): 10 tenants on `hospital_starter`,
all `trialing`; none on `hospital_professional`, `hospital_enterprise` or
`hospital_network`. `synapse_os_basic_annual` (1 active) and `synapse_lab_annual`
(1 active) have zero `plan_features` until this seed is applied, so their hospital
modules resolve only through `tenant_feature_overrides`.

`tenant_subscriptions` is unique per tenant. Reassignment is one `plan_id` update per tenant, after this seed exists. `tenant_feature_overrides` win over the plan and must be read first (`SELECT feature_key, enabled FROM tenant_feature_overrides WHERE tenant_id = …`). Do not bulk-update production.

Safe procedure, acceptance database only, after this seed is applied:

```sql
-- inspect
SELECT t.slug, sp.slug AS plan, ts.status
FROM tenant_subscriptions ts
JOIN subscription_plans sp ON sp.id = ts.plan_id
JOIN tenants t ON t.id = ts.tenant_id
WHERE sp.slug LIKE 'hospital_%';

-- one tenant
UPDATE tenant_subscriptions
SET plan_id = (SELECT id FROM subscription_plans WHERE slug = 'synapse_os_basic_annual'),
    updated_at = now()
WHERE tenant_id = '<tenant>'
  AND plan_id = (SELECT id FROM subscription_plans WHERE slug = 'hospital_starter');
```

Rollback is the same update pointed back at the previous `plan_id`. Record the old id before changing it. This file does not perform that update.
