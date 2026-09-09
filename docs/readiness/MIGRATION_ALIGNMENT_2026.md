# Production Migration Alignment 2026

Date: 2026-09-09
Project: `qfqakzmjatszisuqjwon`
Repository baseline: `e436f533993d1fc24af5efe23a63fb39ba9541ca`

## Evidence Boundary

The repository contains migration files through `20260909100000_manual_subscription_grants.sql`. The production migration head reported by the release audit is `20260907123159_backfill_canonical_hospital_locations`. Local Supabase credentials were not available during this run, so no migration was applied and no remote schema query was performed here.

`REPO_PRESENT` is established from the working tree. `REMOTE_APPLIED` is only marked from the verified remote history supplied for this closeout; it is not inferred from file presence.

| VERSION | NAME | REPO_PRESENT | REMOTE_APPLIED | REQUIRED_BY | RISK | STATUS |
|---|---|---:|---:|---|---|---|
| `20260907123159` | `backfill_canonical_hospital_locations` | yes | yes | Existing facility/clinical routing | Medium | ALIGNED_HEAD |
| `20260908120000` | `lab_reports_release_artifacts` | yes | no | Lab release/report/FHIR evidence | High | BLOCKED_PENDING_APPLY |
| `20260909100000` | `manual_subscription_grants` | yes | no | Platform manual grants and pilot entitlements | High | BLOCKED_PENDING_APPLY |

## Required Operator Action

Configure the CI/deployment environment with:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN` for the optional migration push job
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SYNAPSE_JWT_SECRET`

Then enable `ENABLE_DB_PUSH=true` only after reviewing the two migrations against the target project. Run the dry-run first, apply in timestamp order, and verify the remote migration history and schema objects afterward.

## Schema Verification Checklist

For `lab_reports_release_artifacts` verify `lab_reports`, tenant RLS, the tenant policy, the final-report uniqueness index, version uniqueness, and report indexes.

For `manual_subscription_grants` verify `subscription_grants`, tenant RLS, platform write policy, plan foreign key, idempotency index, active/tenant indexes, and that payment/subscription rows are unchanged by grants.

## Current Decision

Migration alignment is **YELLOW**. Code and migration files are present, but remote application and live schema verification remain unproven until an authorized operator supplies the required credentials.