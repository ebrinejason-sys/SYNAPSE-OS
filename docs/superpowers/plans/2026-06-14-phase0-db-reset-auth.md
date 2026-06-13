# Phase 0: DB Reset + Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe all user/tenant data from Supabase, re-create admin accounts for Ebrine and Nathan, and confirm Resend OTP email + synapse_session login works end-to-end.

**Architecture:** Direct Supabase MCP calls to delete rows in FK-safe order. Admin accounts created via `supabase.auth.admin.createUser` + manual `profiles` insert with `role = 'platform_admin'`. Resend smoke test via the existing `/api/auth/otp-send` + `/api/auth/otp-verify` endpoints on the pharmacy app (which already use `synapse_session`).

**Tech Stack:** Supabase MCP, @synapse/auth, Next.js API routes (existing)

---

## Task 1: Wipe dependent pharmacy/tenant data

Delete rows in FK order (children before parents). Use `execute_sql` via the Supabase MCP.

- [ ] **Step 1: Delete pharmacy_onboarding rows**

```sql
DELETE FROM pharmacy_onboarding;
```

- [ ] **Step 2: Delete pharmacy_user_settings rows**

```sql
DELETE FROM pharmacy_user_settings;
```

- [ ] **Step 3: Delete pharmacy_products rows**

```sql
DELETE FROM pharmacy_products;
```

- [ ] **Step 4: Delete pharmacy_stores rows**

```sql
DELETE FROM pharmacy_stores;
```

- [ ] **Step 5: Delete pharmacy_profiles rows**

```sql
DELETE FROM pharmacy_profiles;
```

- [ ] **Step 6: Delete synapse_sessions rows**

```sql
DELETE FROM synapse_sessions;
```

- [ ] **Step 7: Delete auth_otps rows**

```sql
DELETE FROM auth_otps;
```

- [ ] **Step 8: Delete tenant_subscriptions rows (if table exists)**

```sql
DELETE FROM tenant_subscriptions;
```

- [ ] **Step 9: Delete facility_subscriptions rows (if table exists)**

```sql
DELETE FROM facility_subscriptions;
```

- [ ] **Step 10: Delete audit_log rows**

```sql
DELETE FROM audit_log;
```

- [ ] **Step 11: Delete support_tickets rows (if table exists)**

```sql
DELETE FROM support_tickets;
```

- [ ] **Step 12: Delete profiles rows**

```sql
DELETE FROM profiles;
```

- [ ] **Step 13: Delete tenants rows**

```sql
DELETE FROM tenants;
```

- [ ] **Step 14: Verify all tables empty**

```sql
SELECT
  (SELECT COUNT(*) FROM profiles) AS profiles,
  (SELECT COUNT(*) FROM tenants) AS tenants,
  (SELECT COUNT(*) FROM synapse_sessions) AS sessions,
  (SELECT COUNT(*) FROM pharmacy_onboarding) AS onboarding;
```

Expected: all values = 0

---

## Task 2: Delete all Supabase Auth users

- [ ] **Step 1: List existing auth users via Supabase MCP**

Use `execute_sql`:
```sql
SELECT id, email FROM auth.users ORDER BY created_at;
```

Note all user IDs returned.

- [ ] **Step 2: Delete all auth.users rows**

```sql
DELETE FROM auth.users;
```

- [ ] **Step 3: Verify auth.users is empty**

```sql
SELECT COUNT(*) FROM auth.users;
```

Expected: 0

---

## Task 3: Create Ebrine's platform_admin account

- [ ] **Step 1: Create auth user for Ebrine**

```sql
-- Supabase does not allow direct INSERT into auth.users from SQL easily.
-- Use the Supabase MCP admin API or execute via supabase_admin.auth.admin.createUser
-- If MCP supports it, call: supabase.auth.admin.createUser({ email: 'ebrinetushabe@gmail.com', email_confirm: true })
-- Otherwise run this SQL (Supabase internal format):
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'ebrinetushabe@gmail.com',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ebrine Tushabe"}',
  false,
  ''
);
```

Capture the generated `id` from the result.

- [ ] **Step 2: Create Ebrine's profile row**

```sql
INSERT INTO profiles (id, email, full_name, first_name, last_name, role, is_admin)
VALUES (
  '<uuid-from-step-1>',
  'ebrinetushabe@gmail.com',
  'Ebrine Tushabe',
  'Ebrine',
  'Tushabe',
  'platform_admin',
  true
);
```

- [ ] **Step 3: Verify profile was created**

```sql
SELECT id, email, role FROM profiles WHERE email = 'ebrinetushabe@gmail.com';
```

Expected: 1 row with `role = 'platform_admin'`

---

## Task 4: Create Nathan's platform_admin account

Nathan's email is not yet confirmed. Create a placeholder — update the email when Nathan's address is provided.

- [ ] **Step 1: Create auth user for Nathan**

```sql
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'nathan@synapseos.tech',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Nathan"}',
  false,
  ''
);
```

- [ ] **Step 2: Create Nathan's profile row**

```sql
INSERT INTO profiles (id, email, full_name, first_name, role, is_admin)
VALUES (
  '<uuid-from-step-1>',
  'nathan@synapseos.tech',
  'Nathan',
  'Nathan',
  'platform_admin',
  true
);
```

- [ ] **Step 3: Verify both admins exist**

```sql
SELECT email, role FROM profiles WHERE role = 'platform_admin';
```

Expected: 2 rows (ebrinetushabe@gmail.com, nathan@synapseos.tech)

---

## Task 5: Smoke-test Resend + OTP login for Ebrine

- [ ] **Step 1: Trigger OTP send to ebrinetushabe@gmail.com**

In a terminal, call the pharmacy OTP send endpoint (or use the pharmacy login page):

```bash
curl -X POST https://pharm-YOURSLUG.synapseos.tech/api/auth/otp-send \
  -H "Content-Type: application/json" \
  -d '{"email":"ebrinetushabe@gmail.com"}'
```

Expected response: `{"ok":true}` or `{"sent":true}`

Check: email arrives in inbox within 30 seconds.

- [ ] **Step 2: Verify the OTP**

```bash
curl -X POST https://pharm-YOURSLUG.synapseos.tech/api/auth/otp-verify \
  -H "Content-Type: application/json" \
  -d '{"email":"ebrinetushabe@gmail.com","otp":"123456"}'
```

Replace `123456` with the actual code from the email.

Expected response: `{"ok":true}`

Check: response `Set-Cookie` header contains `synapse_session=...`

- [ ] **Step 3: Verify session was created in DB**

```sql
SELECT user_id, app, created_at FROM synapse_sessions ORDER BY created_at DESC LIMIT 5;
```

Expected: 1 row for Ebrine's user ID, `app = 'pharmacy'`

- [ ] **Step 4: Test the platform admin login**

Navigate to `admin.synapseos.tech/platform/login` in a browser.
Enter `ebrinetushabe@gmail.com` and request OTP.
Confirm OTP email arrives and login succeeds (redirects to `/platform` overview).

- [ ] **Step 5: Commit Phase 0 completion note**

```bash
git add -A
git commit -m "chore: Phase 0 complete — DB wiped, admin accounts created, Resend verified"
```
