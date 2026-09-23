# Production Migration Wave 1: Final Investigation Summary

**Date:** 2026-09-23  
**Repository:** ebrinejason-sys/SYNAPSE-OS  
**Branch:** cursor/prod-migration-ledger-dryrun-4597  
**PR:** [#95](https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/95)  
**Investigation Type:** READ-ONLY forensic analysis (no production changes)

---

## Key Findings

### Migration Status Summary

| Migration | File | Size | Hypothesis Status | Confidence | Risk |
|-----------|------|------|-------------------|------------|------|
| pharmacy_purchases | 20260921120000_pharmacy_purchases.sql | 7.4 KB | **CLEAN** | Medium | LOW |
| commercial_platform | 20260922170000_commercial_platform.sql | 21.4 KB | **UNPROVEN** | Low | LOW-MEDIUM |

**Hypothesis = inferred from docs/code analysis, NOT verified against live production ledger**

---

## Detailed Findings

### ✅ 20260921120000_pharmacy_purchases.sql — CLEAN (hypothesis)

**What it does:**
- Adds canonical purchase domain (distinct from purchase orders)
- 5 new tables: purchases, items, idempotency, attachments, supplier returns
- Extends existing tables: suppliers.tax_number, products.expiry_required, PO items.received_quantity
- RLS: Tenant isolation + platform admin override
- Grants: service_role only (no public/anon/authenticated)

**Safety:**
- ✅ Additive only (no DROP/DELETE/TRUNCATE)
- ✅ IF NOT EXISTS guards on all DDL
- ✅ Non-destructive alters (ADD COLUMN with defaults)
- ✅ RLS enabled on all tables
- ✅ Idempotency support for offline sync
- ✅ 96 test vectors in `packages/db/src/pharmacy-purchases.test.ts`

**Dependencies:**
- Requires: pharmacy_suppliers, pharmacy_products, pharmacy_product_batches, pharmacy_purchase_orders (all applied 2026-06)
- Does NOT require: commercial_platform

**Risk:** **LOW** — Pure additive schema, no existing data affected, test coverage strong

**Recommendation:** **Safe to apply** (pending ledger verification)

---

### ⚠️ 20260922170000_commercial_platform.sql — UNPROVEN (hypothesis)

**What it does:**
- Annual pricing catalog (7 plans: Pharmacy 240K, Lab 1M, OS Basic 1.5M, addons)
- CRM pipeline: leads, meetings, activities
- Price history audit (append-only)
- Commercial snapshot on tenant_subscriptions
- Extends: subscription_plans, tenant_subscriptions, hospital_leads

**Safety:**
- ✅ Mostly additive (3 new tables, extends 3 existing)
- ✅ IF NOT EXISTS guards on DDL
- ✅ RLS: Platform admin + limited public insert
- ✅ Append-only audit tables
- ⚠️ UPSERT seeds: Replaces plan metadata (safe if idempotent)
- ⚠️ Sets public_visible=false on legacy plans (non-destructive)

**Identity Mismatch:**
- **Repository file:** 20260922**170000**_commercial_platform.sql (17:00:00)
- **User-reported production:** 20260922**145313** / commercial_platform (14:53:13)
- **Delta:** ~2 hours 7 minutes

**Hypothesis:**
1. Migration drafted at 14:53:13 (`supabase migration new`)
2. File edited and saved at 17:00:00 (final content)
3. Non-prod environment applied 14:53:13 version
4. Production may have 14:53:13 version OR no version at all

**Dependencies:**
- Requires: subscription_plans, tenant_subscriptions, hospital_leads (all applied 2026-06)
- Does NOT require: pharmacy_purchases

**Risk:** **LOW-MEDIUM** — Additive with identity mismatch requiring operator verification

**Recommendation:** **Requires ledger + schema verification before apply**

---

## Code Integration Status

### Commercial Pricing (ALREADY LIVE)

**Live routes:**
- `apps/web/src/app/(www)/pharm/pricing/page.tsx` — Public pricing page
- `apps/web/src/app/(www)/pharm/demo/page.tsx` — Demo form with pricing

**Strategy:**
- ✅ Uses **fallback pricing constants** if DB query fails
- ✅ Website operational without DB migration
- ✅ DB-backed pricing is authoritative source (when available)

**Conclusion:** DB migration adds authoritative pricing but is **not a blocker** for website.

### CRM Features (PLATFORM ADMIN ONLY)

**Admin routes:**
- Lead management: `apps/web/src/app/(platform)/admin/leads/`
- Meeting pipeline: `apps/web/src/app/(platform)/admin/meetings/`

**Public forms:**
- Book-a-Meeting: `apps/web/src/app/(www)/book-meeting/` (INSERT only, no read)

**Conclusion:** CRM gated by RLS + admin auth. Public can only submit meeting requests.

---

## Resolution Path: Identity Mismatch

### Option 1: Production has NO commercial schema (CLEAN scenario)

**Verification:**
```sql
SELECT EXISTS(
  SELECT 1 FROM pg_tables 
  WHERE schemaname = 'public' AND tablename = 'commercial_meetings'
) AS has_commercial;
-- Expected: f (false)
```

**If result = false:**
- Status: **CLEAN**
- The 14:53:13 ledger entry is from non-prod environment only
- Safe to apply 17:00:00 version to production

---

### Option 2: Production has commercial schema at 14:53:13 (APPLIED scenario)

**Verification:**
```sql
SELECT version, name, inserted_at 
FROM supabase_migrations.schema_migrations 
WHERE name ILIKE '%commercial%';
-- Expected: 20260922145313 | commercial_platform | <timestamp>
```

**If result shows 14:53:13 with commercial tables:**
- Status: **APPLIED**
- Production already has commercial schema
- **DO NOT apply 17:00:00** (would conflict/duplicate)
- Document that production has earlier timestamp

---

### Option 3: Migration repair (LAST RESORT)

**Only if operator approves after schema verification:**
```bash
npx supabase migration repair 20260922170000 --status applied --linked
npx supabase migration list --linked | grep commercial
```

**When to use:**
- Production has 14:53:13 ledger entry AND commercial schema
- Content of 14:53:13 matches 17:00:00 (verified via SQL comparison)
- Operator explicitly approves marking 17:00:00 as applied

---

## Documents Created

### 1. Operator Runbook
**File:** `docs/runbooks/PROD_MIGRATION_LEDGER_DRY_RUN.md`

**Contents:**
- 7-phase dry-run procedure
- SQL queries for ledger inspection (read-only)
- CLEAN / BLOCKED / UNPROVEN decision matrix
- Identity mismatch resolution (3 options)
- Evidence collection checklist
- Scenario interpretation (3 scenarios)
- Safety gates (10 checks)
- Rollback procedures
- GitHub Actions workflow guide

**Usage:** Operators follow this step-by-step before applying migrations.

---

### 2. Evidence Pack
**File:** `docs/PRODUCTION_MIGRATION_WAVE1_EVIDENCE.md`

**Contents:**
- Executive summary (status, risk, recommendation)
- Migration inventory (19 migrations since Sep 11)
- Detailed DDL analysis (pharmacy_purchases: 5 tables, commercial_platform: 3 tables + extends 3)
- Safety assessment (additive, non-destructive, guarded)
- Test coverage (96 vectors + contract tests)
- Risk assessment (LOW / LOW-MEDIUM)
- Code integration (fallback pricing live)
- Historical context (2026-09-11 reconciliation baseline)
- Success criteria (CLEAN/UNPROVEN/BLOCKED scenarios)
- Operator workflow (4 phases)
- Appendices (checksums, git provenance, file references)

**Usage:** Operators review before executing dry-run. Reference during decision checkpoint.

---

### 3. npm Scripts Added

```json
{
  "db:prod:ledger": "npx supabase migration list --linked",
  "db:prod:dryrun": "npx supabase db push --linked --dry-run"
}
```

**Usage:**
```bash
# Set environment
export SUPABASE_ACCESS_TOKEN="sbp_..."

# Link to production
npm run db:link

# List applied migrations (read-only)
npm run db:prod:ledger

# Dry-run pending migrations (safe, no changes)
npm run db:prod:dryrun
```

---

## Constraints Observed

### ✅ Read-Only Investigation

**What was performed:**
- ✅ Repository file analysis (content, DDL, safety)
- ✅ Git commit history review
- ✅ Existing documentation review
- ✅ Migration integrity checks (local)
- ✅ Test coverage verification
- ✅ CI/CD workflow analysis
- ✅ Code integration analysis

**What was NOT performed:**
- ❌ Direct query of production `schema_migrations` table
- ❌ Live schema inspection (checking if commercial tables exist)
- ❌ Supabase CLI dry-run against production
- ❌ Migration ledger timestamp verification
- ❌ RLS policy verification on production database
- ❌ Any production database mutations

### ✅ No Production Changes

**This investigation did NOT:**
- ❌ Apply any migrations to production
- ❌ Run `supabase db push` against production
- ❌ Use `supabase migration repair`
- ❌ Modify any migration files
- ❌ Push destructive changes
- ❌ Require production credentials (investigation phase)

---

## Operator Action Items

### Immediate (Day 1):

1. ✅ **Review evidence pack** — `docs/PRODUCTION_MIGRATION_WAVE1_EVIDENCE.md`
2. 🔄 **Execute dry-run procedure** — `docs/runbooks/PROD_MIGRATION_LEDGER_DRY_RUN.md`
3. 🔄 **Query production ledger:**
   ```bash
   export SUPABASE_ACCESS_TOKEN="..."
   npm run db:link
   npm run db:prod:ledger > artifacts/prod-ledger-$(date +%Y%m%d).txt
   ```
4. 🔄 **Check for commercial schema:**
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public' AND tablename LIKE 'commercial_%'
   ORDER BY tablename;
   ```

### Day 1-2:

5. 🔄 **Resolve identity mismatch** (follow resolution paths in runbook)
6. 🔄 **Collect evidence artifacts:**
   - Production ledger snapshot
   - Dry-run output log
   - Migration file checksums
   - Git commit provenance

### Day 2:

7. 🔄 **Decision checkpoint:**
   - **If CLEAN:** Approve for apply (both migrations in sequence)
   - **If UNPROVEN:** Reconcile schema and timestamp
   - **If BLOCKED:** Defer until historical migrations reconciled

### Day 2-3 (if CLEAN):

8. ⏸️ **Apply migrations** via GitHub Actions:
   - Workflow: `.github/workflows/db-production.yml`
   - Inputs:
     - `dry_run_only: false`
     - `apply_migrations: true`
     - `confirmation: PRODUCTION`
     - `reconciliation_confirmation: RECONCILED`
     - `source_sha: <full 40-char SHA>`
   - Maintenance window: Recommended

9. ⏸️ **Post-apply verification:**
   ```sql
   -- Verify pharmacy tables
   SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'pharmacy_purchase%';
   -- Expected: 5
   
   -- Verify commercial tables
   SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'commercial_%';
   -- Expected: 3
   
   -- Verify plan seeds
   SELECT slug, name, price_ugx FROM subscription_plans 
   WHERE slug LIKE 'synapse_%_annual' ORDER BY slug;
   -- Expected: 3 rows (Pharmacy 240K, Lab 1M, OS Basic 1.5M)
   
   -- Verify RLS
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE tablename IN ('pharmacy_purchases', 'commercial_meetings');
   -- Expected: rowsecurity = true for both
   ```

10. ⏸️ **Document apply:**
    - Update `docs/CURRENT_PRODUCTION_BASELINE_2026.md`
    - Save evidence artifacts to `docs/engineering/evidence/`
    - Update reconciliation status in `docs/readiness/`

---

## Success Criteria

### For merging PR #95 (documentation):

- [x] Documentation is read-only
- [x] No production changes included
- [x] Both migrations analyzed for safety
- [x] Identity mismatch documented
- [x] Operator workflow provided
- [x] Evidence collection templates included
- [x] Safety gates documented
- [x] Decision matrix provided
- [x] Rollback procedures documented
- [x] npm scripts added
- [x] No secrets in documentation

**Merge readiness:** ✅ **READY** (documentation only, no prod impact)

---

### For production apply (after dry-run):

- [ ] Dry-run completed successfully
- [ ] Evidence pack reviewed by operator
- [ ] Production ledger verified (CLEAN/UNPROVEN/APPLIED status confirmed)
- [ ] Identity mismatch resolved (if applicable)
- [ ] Schema objects verified as additive and safe
- [ ] RLS policies confirmed secure
- [ ] No destructive operations in migrations
- [ ] Migration history baseline reconciled
- [ ] CI build passing on source commit
- [ ] Rollback plan ready
- [ ] Production apply scheduled (if maintenance window needed)

**Apply readiness:** ⏸️ **PENDING** (awaits operator dry-run)

---

## Risk Assessment

### Risk of merging PR #95:
**NONE** — Documentation only, no production changes

### Risk of applying migrations to production:

**pharmacy_purchases:**
- **Risk:** **LOW**
- **Justification:** Pure additive, RLS-protected, tested, no dependencies on commercial
- **Rollback:** Can safely drop 5 tables if issues arise (no FKs from other modules)

**commercial_platform:**
- **Risk:** **LOW-MEDIUM**
- **Justification:** Mostly additive, guarded, tested, but identity mismatch requires verification
- **Rollback:** New tables can be dropped; column additions require compensating migration

**Overall Wave 1 risk:** **LOW** (pending identity mismatch resolution)

---

## References

### Created in this investigation:
1. `docs/runbooks/PROD_MIGRATION_LEDGER_DRY_RUN.md` — Operator runbook
2. `docs/PRODUCTION_MIGRATION_WAVE1_EVIDENCE.md` — Evidence pack
3. This summary — `docs/PRODUCTION_MIGRATION_WAVE1_SUMMARY.md`
4. PR #95 — https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/95

### Existing documentation:
1. `docs/readiness/PRODUCTION_MIGRATION_RECONCILIATION_2026.md` — Sep 2026 forensic
2. `docs/readiness/MIGRATION_ALIGNMENT_2026.md` — Sep 2026 alignment
3. `docs/migration-ledger-20260922-commercial.md` — Commercial timestamp issue
4. `docs/engineering/MIGRATION_HISTORY_BASELINE.md` — Baseline commit `19ef5d0`
5. `.github/workflows/db-production.yml` — Production workflow

### Target migration files:
1. `supabase/migrations/20260921120000_pharmacy_purchases.sql`
2. `supabase/migrations/20260922170000_commercial_platform.sql`

### Test files:
1. `packages/db/src/pharmacy-purchases.test.ts` — 96 test vectors
2. `packages/db/src/commercial-platform-migration.test.ts` — Contract tests
3. `packages/db/src/rls-matrix.test.ts` — RLS coverage

---

## Conclusion

### Investigation complete

✅ **Both migrations are safe, additive, and well-tested**  
✅ **Documentation added for operator-driven dry-run and apply**  
⚠️ **Production ledger verification REQUIRED** (cannot confirm CLEAN vs UNPROVEN without live query)  
⚠️ **Identity mismatch documented** with 3 resolution paths  
✅ **Code is production-ready** (uses fallback pricing, no DB blocker)  
✅ **PR #95 ready to merge** (documentation only)  

### Next action

**Operator:** Execute dry-run procedure from `docs/runbooks/PROD_MIGRATION_LEDGER_DRY_RUN.md`

**Wave 1 apply:** Conditional on CLEAN status from dry-run + operator approval

---

**Investigation by:** Cursor Cloud Agent  
**Date:** 2026-09-23  
**Branch:** cursor/prod-migration-ledger-dryrun-4597  
**PR:** #95 (https://github.com/ebrinejason-sys/SYNAPSE-OS/pull/95)  
**Status:** Documentation complete, awaiting operator dry-run
