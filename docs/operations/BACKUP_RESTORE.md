# Backup and restore

**Status:** CURRENT  
**Date:** 2026-09-18  
**Provider:** Supabase project `qfqakzmjatszisuqjwon`

## Assumptions

| Domain | Mechanism | RPO (target) | RTO (target) |
|---|---|---|---|
| Postgres | Supabase daily backups + PITR (Pro) | ≤ 24h without PITR; minutes with PITR | 4h restore to a new project/branch |
| File/storage | Supabase Storage replication; application objects are tenant-scoped | ≤ 24h | 8h |
| Git / migrations | This repository is the schema source of truth | n/a | n/a |

A backup is **not proven** until a restore drill succeeds.

## Restore procedure (non-production drill)

1. Create a disposable Supabase branch or new project. Never restore onto production.
2. `npx supabase db dump` / dashboard backup restore into the disposable target.
3. Apply repo migrations from the **approved SHA** only (`db-production.yml` dry-run first).
4. Run `npm run db:check` and `npm run test:hospital-golden-journey`.
5. Record SHA, backup timestamp, restore timestamp, and pass/fail in `artifacts/readiness/backup-restore-drill.json`.

## Drill status (2026-09-18)

**BLOCKED** — this campaign did not execute a live restore against a disposable Supabase target. Operator must run the drill with `SUPABASE_ACCESS_TOKEN` and a non-production project.

Pharmacy-specific notes remain in `docs/release/PHARM_BACKUP_RECOVERY.md` (HISTORICAL/partial).
