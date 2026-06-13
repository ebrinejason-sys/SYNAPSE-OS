# Phase 9 — RLS / Audit / PHI Hardening Report

**Date:** 2026-06-13  
**Branch:** feat/pharmacy-migration  
**Scope:** All 183+ tables in Supabase project `qfqakzmjatszisuqjwon` (EU-West-1)

---

## Summary

| Check | Result |
|-------|--------|
| Tables with RLS disabled | **0** — all tables have RLS enabled |
| Tables with RLS but zero policies | **0** — all tables have ≥1 policy |
| PHI tables with tenant isolation | **PASS** |
| Auth tables scoped to own rows | **PASS** |
| Cross-tenant profile read (fixed) | **FIXED** — `app_read_profiles` replaced |
| `synapse_sessions` INSERT locked | **FIXED** — service_role only policy added |

---

## Sweep Results

### 1. RLS Enabled Check

Query: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = FALSE`

Result: **empty — all tables have RLS enabled.**

### 2. Policies Exist Check

Query: `SELECT tablename FROM pg_tables t WHERE schemaname = 'public' AND rowsecurity = TRUE AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public')`

Result: **empty — every RLS-enabled table has at least one policy.**

### 3. Critical Table Policy Inventory

| Table | Policies | Notes |
|-------|----------|-------|
| `phi_access_log` | `phi_access_admin_read`, `phi_access_insert`, `platform_admin_bypass`, `tenant_isolation` | Full coverage |
| `audit_log` | `audit_log_admin_read`, `audit_log_service_insert`, `platform_admin_bypass`, `tenant_isolation` | Full coverage |
| `profiles` | `tenant_isolation` (ALL), `platform_admin_bypass` (ALL), `profiles_tenant_read` (SELECT), `users_read_own_profile` (SELECT), `users_update_own_profile` (UPDATE) | `app_read_profiles` removed — was cross-tenant |
| `mfa_enrollments` | `mfa_own_all` | Users can only read/write their own TOTP enrollment |
| `synapse_sessions` | `users_own_sessions_select` (SELECT), `sessions_service_insert` (INSERT) | INSERT locked to service_role |
| `auth_otps` | `auth_otp_own_read` | SELECT scoped to `user_id = auth.uid()` |

---

## Fixes Applied (migration: `rls_phi_hardening`)

### Fix 1: `profiles.app_read_profiles` — Cross-Tenant PHI Exposure

**Problem:** The policy allowed any `auth.role() = 'authenticated'` user to SELECT all profiles regardless of tenant. This was a PHI risk — any authenticated Supabase session could enumerate patients.

**Fix:** Dropped `app_read_profiles`. Added `profiles_tenant_read` which restricts SELECT to:
- Profiles within the user's own tenant (looked up from their own profile), OR
- The user's own profile (`id = auth.uid()`)

This is safe because all server-side code uses `supabaseAdmin` (service role, bypasses RLS). This policy only applies to direct client-side Supabase Auth sessions, which custom-auth users don't have.

### Fix 2: `synapse_sessions.sessions_service_insert` — INSERT Control

Added `sessions_service_insert` policy (INSERT requires `auth.role() = 'service_role'`). Session rows should only be written by the TypeScript auth layer, never by client code.

---

## Architecture Notes

### `same_tenant()` Function Limitation

```sql
-- The function reads the Supabase Auth JWT, not our custom synapse_session:
CREATE OR REPLACE FUNCTION same_tenant(p_tenant_id uuid)
RETURNS boolean AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid = p_tenant_id
$$ LANGUAGE sql SECURITY DEFINER;
```

**Implication:** For custom-auth users (who authenticate via `synapse_session` JWT, not Supabase Auth), `same_tenant()` returns `false` in all client-side calls. This means RLS policies using `same_tenant()` act as "deny all" for client-side custom-auth users.

**Why this is safe:** All data access in Synapse OS goes through TypeScript server-side code using `supabaseAdmin` (service role), which bypasses RLS entirely. Tenant isolation is enforced at the TypeScript layer by:
1. Verifying `synapse_session` JWT in `getContext()`
2. Extracting `tenant_id` from the token payload
3. Scoping all Supabase queries with `.eq('tenant_id', ctx.user.tenant_id)`

Client-side direct Supabase queries are not used in the application.

### Service Role Security

`supabaseAdmin` (service role key) is:
- Only imported in server-side files (`src/lib/`, `src/app/api/`, Server Actions)
- Never exported to client components
- Never passed as a prop or returned in API responses
- The `SUPABASE_SERVICE_ROLE_KEY` env var is not prefixed with `NEXT_PUBLIC_`

---

## PHI Access Logging

All PHI reads in the reasoning engine and longitudinal context builder log to `phi_access_log`:

```typescript
// apps/web/src/lib/longitudinal/context.ts
await logPhiAccess({
  tenantId, userId, patientId,
  resource: 'longitudinal_context',
  purpose:  'clinical_reasoning',
})
```

Log fields: `tenant_id`, `user_id`, `patient_id`, `resource`, `purpose`, `accessed_at`.

The `phi_access_log` table has RLS policies:
- `tenant_isolation` — tenants can only see their own logs
- `platform_admin_bypass` — platform_admin can read all
- `phi_access_insert` — INSERT allowed (for service-role log writes)

---

## Audit Log Coverage

Write operations that trigger `audit_log` entries:

| Operation | Table | Columns logged |
|-----------|-------|----------------|
| Tenant provisioning | `tenants` | `table_name`, `record_id`, `new_value` |
| Reasoning session start | `reasoning_audit` | `event_type`, `actor_id`, `payload` |
| Hypothesis added | `reasoning_audit` | per-event |
| Clinical action taken | `reasoning_audit` | per-event |
| Insurance copilot action | `insurance_copilot_audit` | `action`, `input`, `output` |
| Stock adjustment | `pharmacy_stock_adjustments` | `type`, `previous_qty`, `new_qty`, `created_by` |

---

## Conclusion

Phase 9 RLS hardening is complete. No tables without RLS, no tables without policies. Two security improvements applied. The `same_tenant()` limitation is documented and architecturally acceptable given server-side-only data access pattern.
