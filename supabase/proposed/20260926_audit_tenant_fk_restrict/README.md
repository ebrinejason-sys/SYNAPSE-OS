# PROPOSED migration — audit tables: tenant FK `ON DELETE CASCADE` → `RESTRICT`

**Status: prepared on `fix/release-acceptance-closeout`, NOT applied anywhere.**
It lives outside `supabase/migrations/` on purpose so no pipeline picks it up.
It needs an explicit DB-apply decision. If approved, move `up.sql` into
`supabase/migrations/<timestamp>_audit_tenant_fk_restrict.sql`.

## Why
Production schema (read-only inspection, 2026-09-26):

| table | FK | on delete |
|---|---|---|
| pharmacy_audit_logs | tenant_id → tenants | CASCADE |
| pharmacy_audit_logs | profile_id → profiles | NO ACTION (preserves) |
| audit_log | tenant_id → tenants | CASCADE |
| audit_events | tenant_id → tenants | CASCADE |

A tenant hard delete (the platform "delete pharmacy" action, provisioning
rollbacks) therefore erases that tenant's audit trail. The branch already adds an
application-level guard: `deletePharmacy` refuses when any of these tables has
rows for the tenant. This migration is the database-level backstop.

The pharmacy user DELETE audit wipe was an explicit application delete. It is
fixed in code and needs no schema change.

## Impact assessment
- **Behaviour change:** `delete from tenants` fails with an FK violation (23503)
  when audit rows exist. Intended.
- **Provisioning rollbacks** (`tenants/provision/actions.ts`, pharmacy
  `auth/register`) delete a tenant created seconds earlier. They only fail if an
  audit row was written for that tenant before the rollback. Verify on a preview
  DB before applying.
- **Integration tests** that create and delete throwaway tenants must not write
  audit rows for them, or must clean them up explicitly (test DBs only).
- **Locking:** `NOT VALID` + `VALIDATE` gives a brief ACCESS EXCLUSIVE lock for the
  constraint swap, then a SHARE UPDATE EXCLUSIVE scan. The tables are small
  (pharmacy_audit_logs about 85 rows, audit_log about 107 rows on 2026-09-26).
- **Data:** no rows are modified or deleted.

## Rollback
Run `down.sql`. It restores `ON DELETE CASCADE` and touches no data.

## Historical data risk
Audit rows already removed by past tenant hard deletes or by the old pharmacy
user DELETE cannot be recovered from the database. Only PITR/backups could
restore them.
