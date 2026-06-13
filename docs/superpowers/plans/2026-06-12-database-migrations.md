# Database Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run four groups of Supabase migrations: (1) create the `synapse_sessions` table for custom auth, (2) add `password_hash` and lockout columns to `profiles`, (3) add RLS policies to 13 zero-policy tables so they are no longer locked, (4) add SQL helper functions used by those policies.

**Architecture:** All migrations run against the live project `qfqakzmjatszisuqjwon` (EU-West-1) via the Supabase MCP tool (`mcp__claude_ai_Supabase__apply_migration`). Each migration is atomic. Policies use `SECURITY DEFINER` helper functions to avoid N+1 joins inside every policy. The `synapse_sessions` table is required by `packages/auth` (sessions.ts).

**Tech Stack:** Supabase (PostgreSQL 15), RLS, `SECURITY DEFINER` functions, Supabase MCP tool

---

## Critical note on ordering

Run Task 3 (helper functions) BEFORE Task 4 (zero-policy RLS), because the policies reference `current_tenant_id()` and `is_platform_admin()`.

Recommended order: **Task 1 → Task 2 → Task 3 → Task 4**

---

## Task 1: Create `synapse_sessions` table

This table stores custom auth session tokens (hashed). Required by `packages/auth/src/sessions.ts`.

- [ ] **Step 1: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with project_id `qfqakzmjatszisuqjwon` and the SQL below.

```sql
CREATE TABLE IF NOT EXISTS synapse_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  app          TEXT NOT NULL CHECK (app IN ('web', 'pharmacy', 'mobile', 'api')),
  ip_address   TEXT,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_user
  ON synapse_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_hash
  ON synapse_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_synapse_sessions_user_app
  ON synapse_sessions(user_id, app);

ALTER TABLE synapse_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions (for "active sessions" UI)
CREATE POLICY "users_own_sessions_select" ON synapse_sessions
  FOR SELECT USING (user_id = auth.uid());

-- All other operations (insert/update/delete) go through service role only
-- (service role bypasses RLS by default in Supabase)
```

- [ ] **Step 2: Verify table was created**

Use `mcp__claude_ai_Supabase__execute_sql` with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'synapse_sessions'
ORDER BY ordinal_position;
```

Expected: 10 rows returned (id, user_id, token_hash, app, ip_address, user_agent, expires_at, revoked_at, last_used_at, created_at)

- [ ] **Step 3: Verify RLS is enabled**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'synapse_sessions';
```

Expected: `rowsecurity = true`

- [ ] **Step 4: Commit migration record to git**

Create `supabase/migrations/20260612000001_synapse_sessions.sql` with the SQL from Step 1.

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add supabase/migrations/20260612000001_synapse_sessions.sql
git commit -m "feat(db): add synapse_sessions table for custom auth"
```

---

## Task 2: Add `password_hash` and lockout columns to `profiles`

These columns support the custom password-based login in `packages/auth`. Existing users start with `password_hash = NULL` — the auth migration plan handles the lazy migration path.

- [ ] **Step 1: Apply migration via Supabase MCP**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash         TEXT,
  ADD COLUMN IF NOT EXISTS password_changed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS must_change_password  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_attempts        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;

COMMENT ON COLUMN profiles.password_hash IS
  'bcrypt hash (cost 12) of the user password. NULL means user has not set a custom auth password yet — fall back to Supabase Auth during transition.';

COMMENT ON COLUMN profiles.must_change_password IS
  'Set to true on staff invite. Forces password change on first login.';

COMMENT ON COLUMN profiles.locked_until IS
  'Populated after 10 failed login_attempts. Auth is blocked until this timestamp.';
```

- [ ] **Step 2: Verify columns were added**

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('password_hash','password_changed_at','must_change_password','login_attempts','locked_until')
ORDER BY column_name;
```

Expected: 5 rows

- [ ] **Step 3: Commit migration record**

Create `supabase/migrations/20260612000002_profiles_custom_auth_columns.sql`.

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add supabase/migrations/20260612000002_profiles_custom_auth_columns.sql
git commit -m "feat(db): add password_hash and lockout columns to profiles"
```

---

## Task 3: SQL helper functions for RLS policies

These functions are used by the policies in Task 4. Create them first.

- [ ] **Step 1: Apply migration via Supabase MCP**

```sql
-- Returns the tenant_id of the currently authenticated user.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
-- on the profiles table for this single lookup.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns true if the current user is a platform_admin.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- Returns true if the current user is clinical staff who may access PHI.
CREATE OR REPLACE FUNCTION is_clinical_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('doctor','nurse','clinical_officer','radiologist','hospital_admin')
  );
$$;
```

- [ ] **Step 2: Verify functions were created**

```sql
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name IN ('current_tenant_id','is_platform_admin','is_clinical_staff')
  AND routine_schema = 'public';
```

Expected: 3 rows, all with `security_type = 'DEFINER'`

- [ ] **Step 3: Commit**

Create `supabase/migrations/20260612000003_rls_helper_functions.sql`.

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add supabase/migrations/20260612000003_rls_helper_functions.sql
git commit -m "feat(db): add current_tenant_id, is_platform_admin, is_clinical_staff RLS helpers"
```

---

## Task 4: Fix zero-policy tables

These 13 tables have RLS enabled but zero policies, so nobody can access them. Apply policies for each.

- [ ] **Step 1: Apply migration for `auth_otps` and `mfa_enrollments`**

```sql
-- auth_otps: used only via supabaseAdmin (service role bypasses RLS).
-- No user-facing policy needed, but we add a read-own for auditability.
CREATE POLICY "auth_otps_own_read" ON auth_otps
  FOR SELECT USING (target = (SELECT email FROM profiles WHERE id = auth.uid() LIMIT 1));

-- mfa_enrollments: each user manages their own enrollment.
CREATE POLICY "mfa_own_all" ON mfa_enrollments
  FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration for public-read tables**

```sql
-- health_bulletins: all authenticated users read; platform admin writes.
CREATE POLICY "health_bulletins_auth_read" ON health_bulletins
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "health_bulletins_admin_write" ON health_bulletins
  FOR ALL USING (is_platform_admin());

-- drug_shortage_alerts: same pattern.
CREATE POLICY "drug_shortage_read" ON drug_shortage_alerts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "drug_shortage_admin_write" ON drug_shortage_alerts
  FOR ALL USING (is_platform_admin() OR
    EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hospital_admin'));
```

- [ ] **Step 3: Apply migration for tenant-isolated tables**

```sql
-- refill_reminders
CREATE POLICY "refill_tenant" ON refill_reminders
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- body_register (morgue)
CREATE POLICY "body_register_tenant" ON body_register
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- housekeeping_tasks
CREATE POLICY "housekeeping_tenant" ON housekeeping_tasks
  FOR ALL USING (tenant_id = current_tenant_id());

-- partograph_records
CREATE POLICY "partograph_tenant" ON partograph_records
  FOR ALL USING (tenant_id = current_tenant_id() OR is_platform_admin());

-- facility_resource_logs
CREATE POLICY "facility_resource_tenant" ON facility_resource_logs
  FOR ALL USING (tenant_id = current_tenant_id());

-- visitor_log
CREATE POLICY "visitor_log_tenant" ON visitor_log
  FOR ALL USING (tenant_id = current_tenant_id());
```

- [ ] **Step 4: Apply migration for reporting tables**

```sql
-- surveillance_reports: tenant read, tenant insert, platform admin all.
CREATE POLICY "surveillance_read" ON surveillance_reports
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_platform_admin());

CREATE POLICY "surveillance_insert" ON surveillance_reports
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- sdg_reports: platform admin only.
CREATE POLICY "sdg_platform_admin" ON sdg_reports
  FOR ALL USING (is_platform_admin());
```

- [ ] **Step 5: Apply migration for public-write tables**

```sql
-- newsletter_subscribers: public insert (anyone can subscribe), admin read.
CREATE POLICY "newsletter_public_insert" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "newsletter_admin_read" ON newsletter_subscribers
  FOR SELECT USING (is_platform_admin());
```

- [ ] **Step 6: Verify all 13 tables now have policies**

```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN (
  'auth_otps','mfa_enrollments','health_bulletins','drug_shortage_alerts',
  'refill_reminders','body_register','housekeeping_tasks','partograph_records',
  'facility_resource_logs','visitor_log','surveillance_reports','sdg_reports',
  'newsletter_subscribers'
)
GROUP BY tablename
ORDER BY tablename;
```

Expected: 13 rows, all with `policy_count >= 1`

- [ ] **Step 7: Commit migration files**

Create four migration files:
- `supabase/migrations/20260612000004_fix_auth_otps_mfa_policies.sql`
- `supabase/migrations/20260612000005_fix_public_read_policies.sql`
- `supabase/migrations/20260612000006_fix_tenant_isolated_policies.sql`
- `supabase/migrations/20260612000007_fix_reporting_newsletter_policies.sql`

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add supabase/migrations/
git commit -m "fix(db): add RLS policies to 13 zero-policy tables"
```

---

## Self-Review

**Spec coverage:**
- ✅ `synapse_sessions` table — Task 1
- ✅ `password_hash` + lockout columns on `profiles` — Task 2
- ✅ SQL helper functions (`current_tenant_id`, `is_platform_admin`, `is_clinical_staff`) — Task 3
- ✅ All 13 zero-policy tables have policies — Task 4
  - `auth_otps` ✅
  - `mfa_enrollments` ✅
  - `health_bulletins` ✅
  - `drug_shortage_alerts` ✅
  - `refill_reminders` ✅
  - `body_register` ✅
  - `housekeeping_tasks` ✅
  - `partograph_records` ✅
  - `facility_resource_logs` ✅
  - `visitor_log` ✅
  - `surveillance_reports` ✅
  - `sdg_reports` ✅
  - `newsletter_subscribers` ✅

**Ordering dependency:** Task 3 (helper functions) MUST run before Task 4 (policies that call those functions). Tasks 1 and 2 are independent and can run in any order.

**Safety notes:**
- No `DROP TABLE` or `DROP COLUMN` — all migrations are additive
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS` is safe on a live table (Postgres adds the column with a default, no table lock for nullable columns)
- `synapse_sessions` uses `REFERENCES profiles(id) ON DELETE CASCADE` — safe, existing profiles table already has this pattern
