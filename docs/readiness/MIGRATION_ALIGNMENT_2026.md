# Production Migration Alignment 2026

Date: 2026-09-09
Project: `qfqakzmjatszisuqjwon`
Repository baseline: `8ce25f59f4fdeb7c8ab8b99e4d536f270a001f1b`

## Evidence Boundary

The repository contains migration files through `20260909130000_scope_pharmacy_receipts_to_tenant.sql`. Authenticated GitHub CI reached the production project and the Supabase dry-run reported that production contains many historical migration versions absent from this repository, through `20260907123159_backfill_canonical_hospital_locations`. No migration was applied: dry-run stopped at history reconciliation.

`REPO_PRESENT` is established from the working tree. `REMOTE_APPLIED` is only marked from the verified remote history supplied for this closeout; it is not inferred from file presence.

| VERSION | NAME | REPO_PRESENT | REMOTE_APPLIED | REQUIRED_BY | RISK | STATUS |
|---|---|---:|---:|---|---|---|
| `20260907123159` | `backfill_canonical_hospital_locations` | no | yes | Existing facility/clinical routing | High | HISTORY_DRIFT |
| `20260908120000` | `lab_reports_release_artifacts` | yes | no | Lab release/report/FHIR evidence | High | BLOCKED_PENDING_APPLY |
| `20260909100000` | `manual_subscription_grants` | yes | no | Platform manual grants and pilot entitlements | High | BLOCKED_PENDING_APPLY |
| `20260909130000` | `scope_pharmacy_receipts_to_tenant` | yes | no | Tenant-safe pharmacy receipt uniqueness | High | BLOCKED_PENDING_APPLY |

## Required Operator Action

Configure the CI/deployment environment with:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN` for the optional migration push job
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SYNAPSE_JWT_SECRET`

The current dry-run cannot proceed until migration history is reconciled. Supabase listed remote versions absent from the repository and suggested `supabase db pull` or explicit migration-history repair. Do not run either automatically: pull/review the missing historical migrations or obtain an approved history-repair plan first. After reconciliation, rerun dry-run, review the three pending migrations, apply them in timestamp order, and verify the remote migration history and schema objects afterward.

## Schema Verification Checklist

For `lab_reports_release_artifacts` verify `lab_reports`, tenant RLS, the tenant policy, the final-report uniqueness index, version uniqueness, and report indexes.

For `manual_subscription_grants` verify `subscription_grants`, tenant RLS, platform write policy, plan foreign key, idempotency index, active/tenant indexes, and that payment/subscription rows are unchanged by grants.

## Current Decision

Migration alignment is **RED for release application** and **YELLOW for code**. Authenticated access is now proven, but production migration history is not reproducible from the current repository. No pending migration was applied, and Lab reports, subscription grants, and tenant-scoped receipt uniqueness remain unverified in production.

See [PRODUCTION_MIGRATION_RECONCILIATION_2026.md](PRODUCTION_MIGRATION_RECONCILIATION_2026.md) for the read-only Git/history forensic mapping and the confirmed timestamp-drift example.