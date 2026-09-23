# Production Migration Ledger Dry-Run Runbook

**Target project:** `qfqakzmjatszisuqjwon` (Supabase production)  
**Repository:** `ebrinejason-sys/SYNAPSE-OS`  
**Last reconciliation baseline:** `19ef5d0` (2026-09-11)  
**Production ledger verified:** 2026-09-23 (live check completed)  
**Status:** Documentation for future reference (current status: CLEAN, 10 pending)

---

## Purpose

This runbook provides a **safe, read-only procedure** for operators to inspect the production migration ledger and compare it against the current repository state **without applying any migrations**. Use this to validate migration readiness before executing the manual production workflow.

---

## Prerequisites

1. **Supabase CLI** installed: `npm install -g supabase@^2.107.0`
2. **Access credentials:**
   - `SUPABASE_ACCESS_TOKEN` with project read access
   - `SUPABASE_DB_URL` for direct PostgreSQL queries (optional, for schema inspection)
3. **Current repository checkout** at the commit SHA under review
4. **NO production write permissions** required for dry-run phase

---

## Phase 1: List Applied Migrations on Production

### Using Supabase CLI (recommended)

```bash
# Link to production project (read-only, no schema changes)
npx supabase link --project-ref qfqakzmjatszisuqjwon

# List all applied migrations from remote ledger
npx supabase migration list --linked

# Alternative: Show only remote versions
npx supabase db diff --linked --schema public --file /tmp/remote_schema.sql 2>&1 | grep -i "migration"
```

**Expected output format:**
```
  | 20260911100000 | session_bound_mfa_assurance           | Applied
  | 20260912184600 | encounter_disposition_columns         | Applied
  | 20260921120000 | pharmacy_purchases                    | Pending (if not applied)
  | 20260922170000 | commercial_platform                   | Pending (if not applied)
```

### Using Direct SQL Query (requires `SUPABASE_DB_URL`)

```bash
psql "$SUPABASE_DB_URL" -c "
SELECT version, name, inserted_at 
FROM supabase_migrations.schema_migrations 
ORDER BY inserted_at DESC 
LIMIT 50;
"
```

**Save output to evidence file:**
```bash
psql "$SUPABASE_DB_URL" -c "
SELECT version, name, inserted_at 
FROM supabase_migrations.schema_migrations 
ORDER BY inserted_at DESC 
LIMIT 100;
" > artifacts/production-migration-ledger-$(date -u +%Y%m%d-%H%M%S).log
```

---

## Phase 2: Compare Local Repository Migrations

### List local migrations since reconciliation baseline

```bash
# From repository root
ls -lh supabase/migrations/202609{11..22}*.sql

# Count migrations since Sep 11
ls supabase/migrations/202609{11..22}*.sql 2>/dev/null | wc -l

# Extract filenames and versions
ls supabase/migrations/202609{11..22}*.sql | \
  awk -F/ '{print $NF}' | \
  sed 's/\.sql$//' | \
  sort
```

**Key migrations under review:**
- `20260921120000_pharmacy_purchases.sql`
- `20260922170000_commercial_platform.sql`

### Run repository migration integrity check

```bash
# Validates file structure, no remote access
npm run db:check

# Historical drift detection (requires git history)
npm run db:history:check
```

---

## Phase 3: Identify CLEAN / BLOCKED / UNPROVEN Status

### Decision matrix for each migration:

| Status | Definition | Action |
|--------|------------|--------|
| **CLEAN** | Migration file exists in repo AND is not in production ledger | Safe to apply in sequence |
| **BLOCKED** | Migration depends on another BLOCKED or UNPROVEN migration | Cannot apply until dependencies are resolved |
| **UNPROVEN** | Migration exists in production ledger but content/version differs from repo file | Requires reconciliation (timestamp fix or SQL verification) |
| **APPLIED** | Migration version exists in production ledger with matching name | No action needed |
| **DRIFT** | Version exists in production but name/content differs | Forensic review required (see reconciliation docs) |

### Check specific migrations:

**For `20260921120000_pharmacy_purchases`:**
```bash
# Check if version exists in production ledger
npx supabase migration list --linked | grep "20260921120000"

# If not found: status = CLEAN (safe to apply if no blockers)
# If found: verify name matches "pharmacy_purchases"
```

**For `20260922170000_commercial_platform`:**
```bash
# Check if version exists in production ledger
npx supabase migration list --linked | grep "20260922170000"

# Known conflict: User reported ledger shows "20260922145313 / commercial_platform"
# If 20260922170000 not found but 20260922145313 exists: status = UNPROVEN (identity mismatch)
```

**Check for identity mismatch:**
```bash
# Search production ledger for any commercial_platform entry
npx supabase migration list --linked | grep -i "commercial"

# If found at different timestamp (e.g., 20260922145313):
#   - Document the conflict
#   - Do NOT apply 20260922170000 until timestamp reconciliation
```

---

## Phase 4: Dry-Run Migration Application (No Changes)

### Using Supabase CLI dry-run

```bash
# SAFE: Shows what WOULD be applied without modifying database
npx supabase db push --linked --dry-run 2>&1 | tee artifacts/production-dry-run-$(date -u +%Y%m%d-%H%M%S).log
```

**Expected dry-run output indicators:**

✅ **CLEAN scenario:**
```
Applying migration 20260921120000_pharmacy_purchases.sql...
Applying migration 20260922170000_commercial_platform.sql...
Dry run complete. No changes were applied.
```

❌ **BLOCKED scenario (missing prior migration):**
```
Error: Migration 20260921120000 depends on 20260908120000 which is not applied.
```

⚠️ **UNPROVEN scenario (version conflict):**
```
Error: Migration 20260922145313_commercial_platform already applied.
Cannot apply 20260922170000_commercial_platform.
```

### Verify DDL objects from migration files (static analysis)

```bash
# Check what objects commercial_platform creates
grep -i "CREATE\|ALTER\|DROP" supabase/migrations/20260922170000_commercial_platform.sql | head -20

# Check for destructive operations
grep -i "DROP TABLE\|DELETE FROM\|TRUNCATE" supabase/migrations/20260922170000_commercial_platform.sql

# Verify RLS policies
grep -i "POLICY\|ROW LEVEL SECURITY" supabase/migrations/20260922170000_commercial_platform.sql
```

---

## Phase 5: Evidence Collection Checklist

Before requesting production apply approval, collect and save:

### Required artifacts:

1. **Production ledger snapshot** (last 50-100 migrations)
   ```bash
   npx supabase migration list --linked > artifacts/prod-ledger-$(date -u +%Y%m%d).txt
   ```

2. **Dry-run output** (from Phase 4)
   - Saved to: `artifacts/production-dry-run-YYYYMMDD-HHMMSS.log`

3. **Migration file checksums** (for audit trail)
   ```bash
   sha256sum supabase/migrations/20260921120000_pharmacy_purchases.sql \
             supabase/migrations/20260922170000_commercial_platform.sql \
             > artifacts/migration-checksums-$(date -u +%Y%m%d).txt
   ```

4. **Local migration inventory** (since baseline)
   ```bash
   ls -lh supabase/migrations/202609{11..22}*.sql > artifacts/local-migrations-inventory.txt
   ```

5. **Git commit provenance**
   ```bash
   git log --oneline --since="2026-09-11" -- supabase/migrations/*.sql \
     > artifacts/migration-git-history.txt
   ```

### Optional deep inspection (if UNPROVEN status found):

6. **Schema object verification** (requires `SUPABASE_DB_URL`)
   ```bash
   # Check if commercial tables exist in production
   psql "$SUPABASE_DB_URL" -c "
   SELECT tablename 
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename IN (
       'commercial_price_history',
       'commercial_meetings', 
       'commercial_lead_activities',
       'pharmacy_purchases',
       'pharmacy_purchase_items'
     )
   ORDER BY tablename;
   "
   ```

7. **RLS policy verification**
   ```bash
   psql "$SUPABASE_DB_URL" -c "
   SELECT schemaname, tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('commercial_meetings', 'pharmacy_purchases')
   ORDER BY tablename, policyname;
   "
   ```

---

## Phase 6: Interpret Results

### ✅ Verified Scenario (2026-09-23): Both migrations are CLEAN

**Live production evidence:**
- Last applied: `20260918140000_hospital_billing_payments`
- `20260921120000_pharmacy_purchases` **NOT** in production ledger ✅
- `20260922170000_commercial_platform` **NOT** in production ledger ✅
- Dry-run would show both apply successfully
- No blocking dependencies
- **NO identity mismatch** (145313 hypothesis obsolete — was non-prod env)

**Conclusion:** ✅ **SAFE TO APPLY** in order:
1. Apply pending migrations 1-8 first (if not skipping earlier ones)
2. `20260921120000_pharmacy_purchases.sql` (migration #9)
3. `20260922170000_commercial_platform.sql` (migration #10)

**Technical status:** READY  
**Decision:** Awaiting operator/product approval

---

### ~~Scenario B: Identity mismatch~~ OBSOLETE

**CORRECTION (2026-09-23):** This scenario is **OBSOLETE for production**.

The 145313 timestamp was from a non-production environment. Production has never had `commercial_platform` applied at any timestamp.

---

### ~~Scenario C: Migrations BLOCKED~~ NOT APPLICABLE

**STATUS:** No blocking dependencies detected. All required prior migrations are applied through 20260918140000.

---

## Phase 7: Generate Evidence Pack for Production Apply

Once status determination is complete, create a summary document:

```bash
mkdir -p artifacts/production-evidence-$(date -u +%Y%m%d)
cd artifacts/production-evidence-$(date -u +%Y%m%d)

# Copy all collected artifacts
cp ../prod-ledger-*.txt ./
cp ../production-dry-run-*.log ./
cp ../migration-checksums-*.txt ./
cp ../local-migrations-inventory.txt ./
cp ../migration-git-history.txt ./

# Create summary report
cat > SUMMARY.md << 'EOF'
# Production Migration Readiness Summary

**Date:** $(date -u +%Y-%m-%d)
**Repository SHA:** $(git rev-parse HEAD)
**Target project:** qfqakzmjatszisuqjwon

## Migration Status

### 20260921120000_pharmacy_purchases.sql
- **Status:** [CLEAN/BLOCKED/UNPROVEN/APPLIED]
- **In production ledger:** [YES/NO]
- **Dependencies:** None (standalone tables)
- **Risk assessment:** LOW (additive schema only)
- **Recommendation:** [APPLY/HOLD/SKIP]

### 20260922170000_commercial_platform.sql
- **Status:** [CLEAN/BLOCKED/UNPROVEN/APPLIED]
- **In production ledger:** [YES/NO]
- **Timestamp conflict:** [YES - 20260922145313 vs 20260922170000 / NO]
- **Dependencies:** subscription_plans (exists since 20260612230655)
- **Risk assessment:** LOW (additive schema, upserts with IF NOT EXISTS)
- **Recommendation:** [APPLY/HOLD/SKIP]

## Dry-Run Result

[Copy relevant output from dry-run log]

## Objects Created/Modified

### pharmacy_purchases migration:
- Tables: pharmacy_purchases, pharmacy_purchase_items, pharmacy_purchase_idempotency, pharmacy_purchase_attachments, pharmacy_supplier_returns
- RLS: tenant_isolation policies on all tables
- Grants: service_role only
- Seeds: None

### commercial_platform migration:
- Tables: commercial_price_history, commercial_meetings, commercial_lead_activities
- Alters: subscription_plans (adds pricing columns), tenant_subscriptions (adds commercial snapshot), hospital_leads (extends to CRM)
- Seeds: 7 annual plans (Pharmacy, Lab, OS Basic, OS Lab addon, Enterprise, Intelligence, Exchange)
- RLS: Platform admin + public insert for meetings/leads
- Destructive operations: None

## Approval Checklist

- [ ] Production ledger snapshot saved
- [ ] Dry-run completed without blocking errors
- [ ] Migration file checksums recorded
- [ ] Git commit provenance documented
- [ ] Schema objects reviewed for safety
- [ ] RLS policies verified for security
- [ ] Timestamp conflicts resolved (if any)
- [ ] Dependencies confirmed applied in production
- [ ] Rollback plan documented (if needed)

## Apply Command (when approved)

```bash
# Via GitHub Actions workflow:
# .github/workflows/db-production.yml
# - dry_run_only: false
# - apply_migrations: true
# - confirmation: PRODUCTION
# - reconciliation_confirmation: RECONCILED
# - source_sha: [COMMIT_SHA]

# OR manual CLI (requires SUPABASE_ACCESS_TOKEN):
npx supabase link --project-ref qfqakzmjatszisuqjwon
npx supabase db push --linked
```

## Evidence Files

- Production ledger: prod-ledger-YYYYMMDD.txt
- Dry-run output: production-dry-run-YYYYMMDD-HHMMSS.log
- Migration checksums: migration-checksums-YYYYMMDD.txt
- Local inventory: local-migrations-inventory.txt
- Git history: migration-git-history.txt

---

**Operator signature:** _________________________  
**Review date:** _________________________  
**Approved for apply:** [ ] YES [ ] NO

EOF

echo "Evidence pack created at: $(pwd)"
ls -lh
```

---

## Safety Gates

### Before ANY production apply:

1. ✅ Dry-run completed successfully
2. ✅ Evidence pack reviewed by operator
3. ✅ Timestamp conflicts resolved or documented
4. ✅ Schema objects verified as additive and safe
5. ✅ RLS policies confirmed secure (platform admin only for management)
6. ✅ No destructive operations (DROP, DELETE, TRUNCATE) in migrations
7. ✅ Migration history baseline reconciled (no DRIFT status)
8. ✅ CI build passing on source commit
9. ✅ Rollback plan ready (if schema changes are not trivially reversible)
10. ✅ Production apply scheduled during maintenance window (if applicable)

### Apply workflow confirmation:

The production workflow (`.github/workflows/db-production.yml`) requires:
- ✅ `confirmation: PRODUCTION` (typed exactly)
- ✅ `reconciliation_confirmation: RECONCILED` (typed exactly)
- ✅ `source_sha: <40-char-commit-sha>` (full SHA, not abbreviated)
- ✅ `apply_migrations: true` (after dry-run approval)
- ✅ `dry_run_only: false` (enables apply job)

---

## Rollback Procedure (if needed)

### For additive migrations only:

If migration causes issues but did not delete/modify existing data:

```bash
# DO NOT use migration repair to mark as unapplied
# Instead, create a compensating migration to:
# 1. Drop new tables (if safe)
# 2. Revert ALTER TABLE changes (if safe)
# 3. Document the rollback in migration name

# Example compensating migration:
npx supabase migration new rollback_commercial_platform_20260922

# Edit the file to:
# - DROP TABLE IF EXISTS commercial_meetings CASCADE;
# - DROP TABLE IF EXISTS commercial_price_history CASCADE;
# - DROP TABLE IF EXISTS commercial_lead_activities CASCADE;
# - ALTER TABLE subscription_plans DROP COLUMN IF EXISTS pricing_state CASCADE;
# - (etc., reverse operations in safe order)

# Apply rollback migration:
npx supabase db push --linked
```

### For complex rollbacks:

1. Take database snapshot/backup before apply
2. Contact Supabase support for point-in-time restore
3. Restore from backup to pre-migration state
4. Re-apply only safe migrations

---

## References

- [Migration history baseline](../engineering/MIGRATION_HISTORY_BASELINE.md)
- [Production reconciliation](../readiness/PRODUCTION_MIGRATION_RECONCILIATION_2026.md)
- [Migration alignment](../readiness/MIGRATION_ALIGNMENT_2026.md)
- [Commercial ledger analysis](../migration-ledger-20260922-commercial.md)
- [Production workflow](.github/workflows/db-production.yml)
- Repository package.json scripts: `db:check`, `db:history:check`, `db:link`, `db:migration:list`

---

## Contact

For questions or approval requests:
- Repository: `ebrinejason-sys/SYNAPSE-OS`
- Production workflow: `.github/workflows/db-production.yml`
- Evidence artifacts: `artifacts/production-evidence-YYYYMMDD/`

**END OF RUNBOOK**
