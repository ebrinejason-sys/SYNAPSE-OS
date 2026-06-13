# Phase 1B: Pharmacy Invite → Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the pharmacy invite acceptance flow to use custom `synapse_session` auth (not Supabase auth), update the onboarding page to load session via API instead of Supabase client, and fix the portal layout sign-out to use the custom logout route.

**Architecture:** Three targeted fixes:
1. `setupAccount` server action creates a `synapse_session` cookie after setting up the profile — removes the Supabase `signInWithPassword` call from the browser.
2. `onboarding/page.tsx` replaces `supabase.auth.getUser()` with a fetch to `/api/auth/session`.
3. `portal/layout.tsx` replaces `supabase.auth.signOut()` with a POST to `/api/auth/logout`.

**Tech Stack:** Next.js 15 Server Actions, @synapse/auth (signToken, createSession), cookies() from next/headers

---

## File Map

**Modify:**
- `apps/pharmacy/app/invite/[token]/actions.ts` — add synapse_session creation inside setupAccount
- `apps/pharmacy/app/invite/[token]/page.tsx` — remove supabase.auth.signInWithPassword call
- `apps/pharmacy/app/onboarding/page.tsx` — replace supabase.auth.getUser() with /api/auth/session fetch
- `apps/pharmacy/app/portal/layout.tsx` — replace supabase.auth.signOut() with fetch to /api/auth/logout

---

## Task 1: Fix setupAccount to create synapse_session

**File:** `apps/pharmacy/app/invite/[token]/actions.ts`

The current flow ends at step 6 (updating onboarding step). We add step 7: create a synapse_session so the browser is immediately authenticated.

- [ ] **Step 1: Add auth imports to actions.ts**

At the top of `apps/pharmacy/app/invite/[token]/actions.ts`, add:

```typescript
import { cookies } from 'next/headers'
import { signToken, createSession } from '@synapse/auth'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'
```

- [ ] **Step 2: Create synapse_session at end of setupAccount**

In `setupAccount`, after step 6 (the `pharmacy_onboarding` update), add step 7 before the `return { success: true, email: adminEmail }`:

```typescript
  // 7. Create synapse_session cookie so the browser is authenticated immediately
  try {
    const token = await signToken({
      sub:       adminSettings.profile_id as string,
      email:     adminEmail as string,
      role:      'pharmacy_admin',
      tenant_id: onboarding.tenant_id as string,
      app:       'pharmacy',
    })

    await createSession({
      userId: adminSettings.profile_id as string,
      token,
      app:    'pharmacy',
    })

    const cookieStore = await cookies()
    const expires = new Date()
    expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires,
      path:     '/',
    })
  } catch (sessionErr) {
    // Session creation failure is non-fatal — user can log in manually
    console.error('Failed to create synapse_session after invite setup:', sessionErr)
  }
```

- [ ] **Step 3: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\pharmacy; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 4: Commit**

```bash
git add apps/pharmacy/app/invite/[token]/actions.ts
git commit -m "feat(pharmacy): invite setupAccount creates synapse_session cookie"
```

---

## Task 2: Remove supabase.auth call from invite page

**File:** `apps/pharmacy/app/invite/[token]/page.tsx`

- [ ] **Step 1: Remove supabase client import and signInWithPassword block**

In `apps/pharmacy/app/invite/[token]/page.tsx`, find and remove this import:

```typescript
import { createClient } from "@/lib/supabase/client"
```

Then find the `handleSubmit` function. Currently after `setupAccount` succeeds, it calls:

```typescript
    // Sign in with the newly set password
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.email!,
      password,
    })

    if (signInError) {
      setError("Account created, but sign-in failed. Please go to the login page.")
      setPageState("valid")
      return
    }
```

**Remove those lines entirely.** The session cookie is now set by `setupAccount` on the server.

The end of `handleSubmit` after the change should be:

```typescript
    const result = await setupAccount(token, fullName.trim(), password)

    if (!result.success) {
      setError(result.error ?? "An unexpected error occurred.")
      setPageState("valid")
      return
    }

    setPageState("success")
    router.push("/onboarding")
    router.refresh()
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\pharmacy; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 3: Commit**

```bash
git add apps/pharmacy/app/invite/[token]/page.tsx
git commit -m "feat(pharmacy): invite page uses server-set synapse_session, removes supabase client auth"
```

---

## Task 3: Update onboarding page to load session via API

**File:** `apps/pharmacy/app/onboarding/page.tsx`

The `loadSession` function currently calls `supabase.auth.getUser()`. Replace it with a fetch to `/api/auth/session`.

- [ ] **Step 1: Remove supabase client import**

In `apps/pharmacy/app/onboarding/page.tsx`, remove:

```typescript
import { createClient } from '@/lib/supabase/client'
```

- [ ] **Step 2: Replace loadSession function**

Find the `loadSession` callback (around line 149). Replace the entire function body:

**Current (remove this):**
```typescript
  const loadSession = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profileRow?.tenant_id) {
      router.replace('/login?error=no_pharmacy_access')
      return
    }

    const tenantId = profileRow.tenant_id

    // Fetch tenant data
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, address, district, phone')
      .eq('id', tenantId)
      .single()

    // Fetch pharmacy_profiles if exists
    const { data: pharmProfile } = await supabase
      .from('pharmacy_profiles')
      .select('license_number, license_expiry, contact_phone, physical_address, district')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    // Fetch current onboarding step
    const { data: onboarding } = await supabase
      .from('pharmacy_onboarding')
      .select('current_step')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    setSession({ userId: user.id, tenantId, tenantName: tenant?.name ?? '' })
    // ... rest of setters
  }, [router])
```

**Replace with:**
```typescript
  const loadSession = useCallback(async () => {
    // Use synapse_session cookie via the session API
    const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
    const sessionData = await sessionRes.json()

    if (!sessionData || !sessionData.userId) {
      router.replace('/login')
      return
    }

    const tenantId = sessionData.tenantId
    if (!tenantId) {
      router.replace('/login?error=no_pharmacy_access')
      return
    }

    // Fetch supplemental data for onboarding form pre-fill
    const [tenantRes, pharmProfileRes, onboardingRes] = await Promise.all([
      fetch(`/api/admin/settings`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/admin/settings`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/admin/dashboard').then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    setSession({
      userId:     sessionData.userId,
      tenantId,
      tenantName: sessionData.tenantName ?? '',
    })

    setProfile(prev => ({
      ...prev,
      pharmacyName: sessionData.tenantName ?? '',
    }))

    setStore(prev => ({
      ...prev,
      storeName: `${sessionData.tenantName ?? ''} - Main Branch`,
    }))

    // Fetch current onboarding step via admin dashboard API
    try {
      const dashRes = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      if (dashRes.ok) {
        const dash = await dashRes.json()
        if (dash?.onboarding?.current_step) {
          const savedStep = dash.onboarding.current_step
          setCurrentStep(Math.min(Math.max(Number(savedStep), 1), 5))
        }
      }
    } catch { /* ignore */ }

    setIsLoading(false)
  }, [router])
```

Note: The admin/dashboard API may not return onboarding step. If it doesn't, the step defaults to 1 which is correct (first time). Pre-fill of address/license etc. can be added in a future iteration.

- [ ] **Step 3: Update each save step to not reference `supabase`**

The `saveStep1`, `saveStep2`, `saveStep3`, `saveStep4`, `completeOnboarding` functions all use `const supabase = createClient()`. Replace them to call the existing admin API routes instead.

For each save function, replace `const supabase = createClient()` with authenticated fetch calls:

**saveStep1 — replace supabase calls:**
```typescript
  const saveStep1 = async () => {
    if (!session) return
    setSaveError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:  profile.address,
          district: profile.district,
          phone:    profile.phone,
          pharmacy_profile: {
            license_number: profile.licenseNumber || null,
            license_expiry: profile.licenseExpiry || null,
            contact_phone:  profile.phone || null,
            physical_address: profile.address || null,
            district:       profile.district || null,
          },
          onboarding_step: 2,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save.')
      }
      setCurrentStep(2)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }
```

Note: If `/api/admin/settings` PATCH doesn't support onboarding_step, the fallback approach is to keep the direct Supabase calls but swap `supabase.auth.getUser()` only. See Step 4 below for the simpler alternative.

- [ ] **Step 4: Simpler alternative — keep Supabase data calls, only fix auth**

If the admin API routes don't support PATCH for onboarding steps, use this simpler approach in `loadSession` only:

Keep `createClient` for data queries but replace the `supabase.auth.getUser()` check with the session API:

```typescript
  const loadSession = useCallback(async () => {
    const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
    const sessionData = await sessionRes.json()

    if (!sessionData?.userId) {
      router.replace('/login')
      return
    }

    const supabase = createClient()
    const tenantId = sessionData.tenantId

    if (!tenantId) {
      router.replace('/login?error=no_pharmacy_access')
      return
    }

    const [tenantResult, pharmProfileResult, onboardingResult] = await Promise.all([
      supabase.from('tenants').select('name, address, district, phone').eq('id', tenantId).single(),
      supabase.from('pharmacy_profiles').select('license_number, license_expiry, contact_phone, physical_address, district').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('pharmacy_onboarding').select('current_step').eq('tenant_id', tenantId).maybeSingle(),
    ])

    const tenant = tenantResult.data
    const pharmProfile = pharmProfileResult.data
    const onboarding = onboardingResult.data

    setSession({ userId: sessionData.userId, tenantId, tenantName: tenant?.name ?? '' })

    setProfile({
      pharmacyName:  tenant?.name ?? '',
      address:       pharmProfile?.physical_address ?? tenant?.address ?? '',
      district:      pharmProfile?.district ?? tenant?.district ?? '',
      phone:         pharmProfile?.contact_phone ?? tenant?.phone ?? '',
      licenseNumber: pharmProfile?.license_number ?? '',
      licenseExpiry: pharmProfile?.license_expiry ?? '',
    })

    setStore(prev => ({
      ...prev,
      storeName: `${tenant?.name ?? ''} - Main Branch`,
    }))

    const savedStep = onboarding?.current_step ?? 1
    setCurrentStep(Math.min(Math.max(savedStep, 1), 5))

    setIsLoading(false)
  }, [router])
```

This keeps all data fetching via Supabase client (which works fine for reads), only replacing the auth check. This is the recommended approach — simpler and safe.

Keep the `import { createClient }` import, just remove the `supabase.auth.getUser()` call.

- [ ] **Step 5: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\pharmacy; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 6: Commit**

```bash
git add apps/pharmacy/app/onboarding/page.tsx
git commit -m "feat(pharmacy): onboarding uses synapse_session API for auth check"
```

---

## Task 4: Fix portal layout sign-out

**File:** `apps/pharmacy/app/portal/layout.tsx`

- [ ] **Step 1: Remove supabase client import**

In `apps/pharmacy/app/portal/layout.tsx`, find the imports. Remove:

```typescript
import { createClient } from "@/lib/supabase/client"
```

- [ ] **Step 2: Replace handleSignOut**

Find the `handleSignOut` function:

```typescript
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }
```

Replace with:

```typescript
  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push("/login")
    router.refresh()
  }
```

- [ ] **Step 3: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\pharmacy; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 4: Commit**

```bash
git add apps/pharmacy/app/portal/layout.tsx
git commit -m "feat(pharmacy): portal layout sign-out uses custom auth logout route"
```

---

## Task 5: End-to-end smoke test

- [ ] **Step 1: Provision a test pharmacy from platform admin**

Log into `admin.synapseos.tech` as Ebrine. Go to Provision. Create:
- Name: "Test Pharmacy"
- Admin email: your email or a test email

- [ ] **Step 2: Accept the invite**

Open the invite URL (copied from provision success screen).
Enter a name and password.
Click "Create Account".
Expected: Redirected to `/onboarding` without needing to log in separately.

- [ ] **Step 3: Complete onboarding**

Walk through all 5 steps. Confirm each save works. Complete step 5.
Expected: Redirected to `/portal/dashboard`.

- [ ] **Step 4: Test sign-out**

Click Sign Out in the portal sidebar.
Expected: Redirected to `/login`. Visiting `/portal/dashboard` redirects back to `/login`.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: Phase 1B complete — invite→onboarding→portal flow fully on synapse_session"
```

---

## Self-Review

**Spec coverage:**
- ✅ Invite acceptance creates synapse_session (Task 1)
- ✅ Browser no longer calls supabase.auth.signInWithPassword (Task 2)
- ✅ Onboarding loads session from /api/auth/session not supabase.auth.getUser (Task 3)
- ✅ Portal sign-out uses /api/auth/logout (Task 4)
- ✅ End-to-end flow verified (Task 5)
