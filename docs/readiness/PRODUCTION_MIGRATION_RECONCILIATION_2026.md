# Production Migration History Forensic Reconciliation 2026

Date: 2026-09-09
Repository HEAD: `6e58c40cb54af4660513172f1025b81721f24b0c`
Supabase project: `qfqakzmjatszisuqjwon`

## Scope and Safety

This is a read-only forensic result. No production migration was applied. No `supabase migration repair` was run. No `supabase db pull` output was written into `main`. No historical migration was edited or renamed.

The remote ledger was extracted from the authenticated Supabase dry-run performed by GitHub Actions run `34398896419`. The dry-run connected successfully, then stopped because remote migration versions were absent from the repository migration directory.

## Counts

- `REMOTE_MIGRATION_COUNT`: 139 timestamp versions in the captured remote ledger.
- `LOCAL_MIGRATION_COUNT`: 76 timestamped SQL files plus `demo_schema_init.sql`.
- `EXACT_MATCH_COUNT`: 0 by timestamp/version.
- `REMOTE_ONLY_COUNT`: 139 by timestamp/version.
- `LOCAL_ONLY_COUNT`: 76 by timestamp/version in the current repository snapshot.
- `VERSION_DRIFT_COUNT`: at least 1 confirmed semantic candidate; full count requires remote migration names and SQL bodies, not only the version list emitted by the CLI error.
- `FOUND_IN_HISTORY_COUNT`: 1 confirmed local lineage example.
- `UNKNOWN_COUNT`: 138 remote versions pending name/content export.

The counts above deliberately distinguish timestamp mismatch from SQL absence. A remote-only timestamp does not prove that its SQL is missing: production and the repository demonstrably use different timestamp ledgers.

## Confirmed Version Drift Example

| Remote version/name | Local candidate | Git history | Content match | Status | Recommended action |
|---|---|---|---|---|---|
| `20260612055928_synapse_sessions` | `20260612000001_synapse_sessions.sql` | Local candidate found in commits `9c0f0f9` and `3689e1d` | Cannot prove from current repository alone because the remote SQL body is not available in the CLI error output | `NAME_MATCH_VERSION_DRIFT` candidate | Export remote migration names/bodies or obtain the original historical migration bundle; compare normalized SQL before any ledger action |
| Remote historical versions through `20260907123159` | Current timestamped files | Many local files have different timestamps and some files were modified/replaced in Git history | Unknown without remote SQL bodies | `UNKNOWN` | Build a version/name/content mapping from the Supabase migration history export and Git objects |
| `20260908120000_lab_reports_release_artifacts` | Same local filename | Current main | Local SQL present; not remotely proven applied | `PENDING_NEW` | Apply only after historical ledger reconciliation and a fresh dry-run |
| `20260909100000_manual_subscription_grants` | Same local filename | Current main | Local SQL present; not remotely proven applied | `PENDING_NEW` | Apply only after historical ledger reconciliation and a fresh dry-run |
| `20260909130000_scope_pharmacy_receipts_to_tenant` | Same local filename | Current main | Local SQL present; not remotely proven applied | `PENDING_NEW` | Apply only after historical ledger reconciliation and a fresh dry-run |

## Git Forensics

The complete historical path inventory contains 79 distinct migration paths across all reachable local Git objects. The local history contains the current `20260612000001_synapse_sessions.sql` path and its originating commits, but no exact `20260612055928_synapse_sessions.sql` path. This supports a timestamp/version-ledger rewrite or export mismatch, not proof that the migration operation itself was absent.

For the known local candidate:

- Current raw SHA256: `09f4e5bb9d3010762608e5d80db5be81b5a535af3acc8ee2b2a5cf3d21ca169e`.
- Historical commit `9c0f0f9` contains the same local path and SQL content hash.
- No remote SQL body was available in the Supabase CLI dry-run error, so `IDENTICAL` or `SEMANTICALLY_EQUIVALENT` cannot be asserted yet.

## Classification Rules

- `EXACT_MATCH`: remote version/name and local file correspond, with normalized SQL verified.
- `NAME_MATCH_VERSION_DRIFT`: operation name matches but timestamp differs; SQL comparison still required.
- `SEMANTIC_MATCH_VERSION_DRIFT`: normalized SQL is equivalent despite version/name drift.
- `FOUND_IN_GIT_HISTORY`: historical local path or candidate exists in reachable Git objects.
- `REMOTE_ONLY`: remote version/name has no currently identified candidate.
- `LOCAL_ONLY`: local timestamp has no matching remote timestamp; it may still be an equivalent operation under a different remote version.
- `PENDING_NEW`: intentionally newer migration not yet proven remotely applied.
- `UNKNOWN`: insufficient remote names or SQL content to classify safely.

## Safest Strategy Ranking

1. Export the complete remote migration ledger with names and SQL/source hashes, then map each operation to current and historical Git files.
2. Restore exact historical migration files from Git history when they are available and verified equivalent.
3. Add a documented canonical historical archive if exact source files are unavailable but normalized SQL can be independently verified.
4. Use a reviewed `supabase db pull` only in an isolated forensic branch/worktree, never directly into `main`.
5. Use `supabase migration repair` only as an explicit operator-approved last resort after the mapping and production-schema review are complete.

Do not re-run historical SQL merely to make the CLI ledger green.

## Schema Verification Status

The current environment does not have local Supabase credentials. The CI dry-run authenticated to the project but stopped before applying or verifying pending schema. Therefore the following remain unverified in production:

- `lab_reports` table, RLS, policies, constraints, indexes, and artifact fields.
- `subscription_grants` table, RLS, platform policy, idempotency index, and plan linkage.
- Tenant-scoped receipt uniqueness migration and existing duplicate-pair safety.

## Required Next Forensic Artifact

Obtain a complete remote migration export containing, for every remote version:

- version
- name
- applied timestamp
- source SQL or a trusted normalized SQL hash

Then produce a row-by-row mapping to local files and Git objects. Only rows classified `EXACT_MATCH` or verified `SEMANTIC_MATCH_VERSION_DRIFT` should be considered for a canonical archive. Keep all genuinely new migrations pending until that mapping is reviewed.

## Decision

`MIGRATION HISTORY YELLOW — RECONCILIATION PLAN READY`
