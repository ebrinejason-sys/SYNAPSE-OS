# Phase 1A: Admin Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the platform admin dashboard with pharmacy-specific stats, add invite-based pharmacy provisioning (no password, sends Resend email), add Tenants + Provision to the sidebar, and add onboarding progress + resend invite to the tenant detail page.

**Architecture:** Modify the existing `apps/web/src/app/platform/` pages. The provision action is updated to: skip password for pharmacies, generate an invite token (random UUID), store in `pharmacy_onboarding`, create `pharmacy_user_settings`, and send a Resend email. The platform sidebar gets grouped nav. Overview page gets pharmacy-specific stats row.

**Tech Stack:** Next.js 15 App Router, Server Actions, Resend, @synapse/db/admin, Supabase MCP

---

## File Map

**Modify:**
- `apps/web/src/app/platform/layout.tsx` — add Tenants + Provision to sidebar nav
- `apps/web/src/app/platform/page.tsx` — add pharmacy stats (pharmacies, in-onboarding, trial expiring)
- `apps/web/src/app/platform/tenants/provision/page.tsx` — remove password step for pharmacy; show invite link on success
- `apps/web/src/app/platform/tenants/provision/actions.ts` — add `provisionPharmacy` action (invite token + Resend email)
- `apps/web/src/app/platform/tenants/[id]/page.tsx` — add onboarding progress, resend invite, activate/suspend

---

## Task 1: Add Tenants and Provision to platform sidebar

**File:** `apps/web/src/app/platform/layout.tsx`

- [ ] **Step 1: Add Pill import if missing and add new sidebar items**

In `apps/web/src/app/platform/layout.tsx`, find the `SIDEBAR_ITEMS` array and add two entries after the Facilities entry:

```typescript
const SIDEBAR_ITEMS = [
  { href: "/platform", label: "Overview", icon: Activity, exact: true },
  { href: "/platform/hospitals", label: "Facilities", icon: Building2 },
  { href: "/platform/tenants", label: "All Tenants", icon: ShieldCheck },
  { href: "/platform/tenants/provision", label: "Provision", icon: Pill },
  // ... rest unchanged
```

`Pill` is already imported. `ShieldCheck` is already imported.

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/layout.tsx
git commit -m "feat(platform): add All Tenants and Provision links to sidebar"
```

---

## Task 2: Add pharmacy stats to overview dashboard

**File:** `apps/web/src/app/platform/page.tsx`

- [ ] **Step 1: Add pharmacy-specific data fetching**

In `getOverviewData()`, add these queries to the `Promise.all` list:

```typescript
// Add to the existing Promise.all in getOverviewData():
safeCount("tenants", [["facility_type", "pharmacy"]]),
safeCount("tenants", [["facility_type", "pharmacy"], ["status", "active"]]),
safeCount("pharmacy_onboarding", [["current_step", "lt:5"]]),  // in onboarding
```

Note: `safeCount` with a filter like `["current_step", "lt:5"]` may need a custom implementation. Use `safeRows` instead if needed:

```typescript
const pharmacyOnboardingRows = await safeRows<{ current_step: number }>(
  "pharmacy_onboarding",
  "current_step",
  { limit: 5000 }
)
const inOnboarding = pharmacyOnboardingRows.filter(r => (r.current_step ?? 0) < 5).length
```

- [ ] **Step 2: Add pharmacy stats to the returned data object**

In `getOverviewData()`, add a new `pharmacyStats` field to the return value:

```typescript
return {
  // ... existing fields ...
  pharmacyStats: {
    total: totalPharmacies,
    active: activePharmacies,
    inOnboarding: inOnboarding,
  },
}
```

And update the `OverviewCommandCenterData` type in `apps/web/src/app/platform/_components/overview-command-center.tsx` to include:

```typescript
pharmacyStats?: {
  total: number
  active: number
  inOnboarding: number
}
```

- [ ] **Step 3: Display pharmacy stats in overview-command-center.tsx**

In `apps/web/src/app/platform/_components/overview-command-center.tsx`, after the main stats row, add a pharmacy stats section:

```tsx
{data.pharmacyStats && (
  <div className="grid grid-cols-3 gap-4 rounded-xl border border-[#F97316]/20 bg-[#F97316]/5 p-4">
    <div className="text-center">
      <p className="text-2xl font-bold text-[#F97316]">{data.pharmacyStats.total}</p>
      <p className="text-xs text-slate-400 mt-0.5">Total Pharmacies</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-green-400">{data.pharmacyStats.active}</p>
      <p className="text-xs text-slate-400 mt-0.5">Active</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold text-amber-400">{data.pharmacyStats.inOnboarding}</p>
      <p className="text-xs text-slate-400 mt-0.5">In Onboarding</p>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform/page.tsx apps/web/src/app/platform/_components/overview-command-center.tsx
git commit -m "feat(platform): add pharmacy stats row to overview dashboard"
```

---

## Task 3: Update provision action to support invite-based pharmacy provisioning

**File:** `apps/web/src/app/platform/tenants/provision/actions.ts`

- [ ] **Step 1: Add provisionPharmacy server action**

Append this export to `apps/web/src/app/platform/tenants/provision/actions.ts`:

```typescript
import { Resend } from 'resend'

export interface PharmacyProvisionInput {
  name:          string
  slug:          string
  district:      string
  adminEmail:    string
  adminFullName: string
}

export interface PharmacyProvisionResult {
  ok:         boolean
  tenantId?:  string
  inviteUrl?: string
  error?:     string
}

export async function provisionPharmacy(input: PharmacyProvisionInput): Promise<PharmacyProvisionResult> {
  await requirePlatformAdmin()

  const slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').trim()

  // Check slug uniqueness
  const { data: existing } = await (supabaseAdmin as any)
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) return { ok: false, error: `Subdomain "${slug}" is already taken.` }

  // Check admin email uniqueness
  const { data: existingProfile } = await (supabaseAdmin as any)
    .from('profiles')
    .select('id')
    .eq('email', input.adminEmail.trim().toLowerCase())
    .maybeSingle()

  if (existingProfile) return { ok: false, error: `An account with email "${input.adminEmail}" already exists.` }

  // 1. Create tenant
  const { data: tenant, error: tenantErr } = await (supabaseAdmin as any)
    .from('tenants')
    .insert({
      slug,
      name:          input.name.trim(),
      facility_type: 'pharmacy',
      country:       'Uganda',
      district:      input.district.trim(),
      status:        'pending',
      is_active:     false,
      onboarding_completed: false,
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    return { ok: false, error: tenantErr?.message ?? 'Failed to create pharmacy.' }
  }

  // 2. Create profile (no password — invite only)
  const nameParts = input.adminFullName.trim().split(' ')
  const { data: profile, error: profileErr } = await (supabaseAdmin as any)
    .from('profiles')
    .insert({
      email:      input.adminEmail.trim().toLowerCase(),
      full_name:  input.adminFullName.trim(),
      first_name: nameParts[0] ?? '',
      last_name:  nameParts.slice(1).join(' ') ?? '',
      role:       'pharmacy_admin',
      tenant_id:  tenant.id,
      is_admin:   true,
    })
    .select('id')
    .single()

  if (profileErr || !profile) {
    await (supabaseAdmin as any).from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: profileErr?.message ?? 'Failed to create admin profile.' }
  }

  // 3. Create pharmacy_user_settings
  await (supabaseAdmin as any)
    .from('pharmacy_user_settings')
    .insert({
      profile_id:    profile.id,
      tenant_id:     tenant.id,
      pharmacy_role: 'pharmacy_admin',
      is_admin:      true,
    })
    .catch(() => {})

  // 4. Generate invite token
  const inviteToken = crypto.randomUUID()
  const inviteExpiry = new Date()
  inviteExpiry.setHours(inviteExpiry.getHours() + 72)

  const { error: onboardErr } = await (supabaseAdmin as any)
    .from('pharmacy_onboarding')
    .insert({
      tenant_id:         tenant.id,
      current_step:      0,
      invite_token:      inviteToken,
      invite_expires_at: inviteExpiry.toISOString(),
    })

  if (onboardErr) {
    await (supabaseAdmin as any).from('profiles').delete().eq('id', profile.id)
    await (supabaseAdmin as any).from('tenants').delete().eq('id', tenant.id)
    return { ok: false, error: `Onboarding setup error: ${onboardErr.message}` }
  }

  // 5. Send invite email via Resend
  const baseUrl = process.env.PHARMACY_APP_URL ?? 'https://pharmacy.synapseos.tech'
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    'Synapse OS <noreply@synapseos.tech>',
      to:      input.adminEmail.trim().toLowerCase(),
      subject: `You're invited to set up ${input.name.trim()} on Synapse`,
      html:    `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
          <h2>Welcome to Synapse Pharmacy</h2>
          <p>Hi ${nameParts[0] ?? 'there'},</p>
          <p>Your pharmacy <strong>${input.name.trim()}</strong> has been registered on Synapse OS.</p>
          <p>Click the button below to set up your account. This link expires in 72 hours.</p>
          <a href="${inviteUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Set Up My Account
          </a>
          <p style="color:#666;font-size:12px;">If the button doesn't work, copy this link:<br/>${inviteUrl}</p>
        </div>
      `,
    })
  } catch (emailErr) {
    // Email failure is non-fatal — admin can copy the link
    console.error('Failed to send invite email:', emailErr)
  }

  // 6. Audit log
  await (supabaseAdmin as any).from('audit_log').insert({
    tenant_id:  tenant.id,
    action:     'INSERT',
    table_name: 'tenants',
    record_id:  tenant.id,
    new_value:  { name: input.name, facility_type: 'pharmacy', admin: input.adminEmail },
  }).catch(() => {})

  return { ok: true, tenantId: tenant.id, inviteUrl }
}
```

- [ ] **Step 2: Install resend if not already in apps/web**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS; npm ls resend --workspaces 2>&1 | Select-String "resend"
```

If not present:
```powershell
cd C:\Users\ebrin\SYNAPSE-OS; npm install resend --workspace=apps/web
```

- [ ] **Step 3: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform/tenants/provision/actions.ts package.json package-lock.json
git commit -m "feat(platform): add provisionPharmacy server action with invite token + Resend email"
```

---

## Task 4: Update provision page UI for pharmacy invite flow

**File:** `apps/web/src/app/platform/tenants/provision/page.tsx`

- [ ] **Step 1: Replace the page with a pharmacy-focused form**

Replace the contents of `apps/web/src/app/platform/tenants/provision/page.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { provisionPharmacy } from './actions'

export default function ProvisionPharmacyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    name:          '',
    slug:          '',
    district:      '',
    adminEmail:    '',
    adminFullName: '',
  })

  // Auto-generate slug from name
  useEffect(() => {
    if (form.name) {
      setForm(f => ({
        ...f,
        slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
      }))
    }
  }, [form.name])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.adminEmail || !form.adminFullName) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await provisionPharmacy(form)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Provisioning failed.')
      return
    }
    setInviteUrl(result.inviteUrl ?? null)
    setTenantId(result.tenantId ?? null)
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inviteUrl) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pharmacy provisioned!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Invite email sent to <strong className="text-white">{form.adminEmail}</strong>.
            If email delivery fails, share the link below directly.
          </p>
          <div className="bg-[#111117] border border-slate-800 rounded-xl p-3 text-left flex items-center gap-3 mb-4">
            <span className="text-xs text-slate-400 break-all flex-1">{inviteUrl}</span>
            <button onClick={copyLink} className="shrink-0 text-slate-400 hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => router.push(`/platform/tenants/${tenantId}`)}
              className="flex items-center gap-2 bg-[#F97316] text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-orange-500 transition-colors"
            >
              View Tenant <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setInviteUrl(null); setForm({ name: '', slug: '', district: '', adminEmail: '', adminFullName: '' }) }}
              className="border border-slate-700 text-slate-300 rounded-xl px-5 py-2.5 text-sm hover:border-slate-500 transition-colors"
            >
              Provision Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputCls = "w-full rounded-lg border border-slate-700 bg-[#111117] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-[#F97316] focus:outline-none transition-colors"
  const labelCls = "block mb-1 text-xs text-slate-400 font-medium"

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Provision New Pharmacy</h1>
        <p className="text-sm text-slate-400 mt-1">An invite email will be sent to the pharmacy admin to set up their account.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-[#0B0B12] p-6 space-y-4">
        <div>
          <label className={labelCls}>Pharmacy Name *</label>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nakato Pharmacy" required />
        </div>

        <div>
          <label className={labelCls}>Subdomain (auto-generated)</label>
          <div className="flex items-center gap-2">
            <input className={inputCls} value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="nakato-pharmacy" />
            <span className="text-xs text-slate-500 shrink-0">.synapseos.tech</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>District</label>
          <input className={inputCls} value={form.district} onChange={e => set('district', e.target.value)} placeholder="Kampala" />
        </div>

        <hr className="border-slate-800" />

        <div>
          <label className={labelCls}>Admin Full Name *</label>
          <input className={inputCls} value={form.adminFullName} onChange={e => set('adminFullName', e.target.value)} placeholder="Jane Nakato" required />
        </div>

        <div>
          <label className={labelCls}>Admin Email *</label>
          <input className={inputCls} type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@nakatopharmacy.ug" required />
        </div>

        {error && (
          <p className="text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-orange-500 text-black font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning…</> : 'Provision & Send Invite'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/provision/page.tsx
git commit -m "feat(platform): pharmacy provision page with invite-only flow"
```

---

## Task 5: Enhance tenant detail page

**File:** `apps/web/src/app/platform/tenants/[id]/page.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/web/src/app/platform/tenants/[id]/page.tsx` to understand its current structure.

- [ ] **Step 2: Add onboarding progress section**

After the existing tenant metadata section, add an onboarding progress indicator. First, fetch onboarding data in the page's data loading:

```typescript
const { data: onboarding } = await supabaseAdmin
  .from('pharmacy_onboarding')
  .select('current_step, invite_token, invite_expires_at, account_created_at')
  .eq('tenant_id', params.id)
  .maybeSingle()
```

Then render a step progress bar in the JSX:

```tsx
{onboarding && (
  <div className="rounded-xl border border-slate-800 bg-[#0B0B12] p-5">
    <h3 className="text-sm font-semibold text-white mb-4">Onboarding Progress</h3>
    <div className="flex items-center gap-2">
      {['Account Setup', 'Profile', 'Store', 'Products', 'Network', 'Complete'].map((label, i) => {
        const stepNum = i // step 0 = invite accepted, 1-5 = onboarding steps
        const done = (onboarding.current_step ?? 0) > stepNum
        const active = (onboarding.current_step ?? 0) === stepNum
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-black' : active ? 'bg-[#F97316] text-black' : 'bg-slate-800 text-slate-500'}`}>
              {done ? '✓' : i + 1}
            </div>
            <span className="text-[10px] text-slate-500 truncate hidden sm:block">{label}</span>
            {i < 5 && <div className="h-px flex-1 bg-slate-800" />}
          </div>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 3: Add Resend Invite + Activate/Suspend buttons**

Add an actions row to the page. Create a server action `resendInvite(tenantId: string)` in a new file `apps/web/src/app/platform/tenants/[id]/actions.ts`:

```typescript
'use server'

import { requirePlatformAdmin } from '../../../../lib/platform/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { Resend } from 'resend'

export async function resendPharmacyInvite(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin()

  const { data: onboarding } = await (supabaseAdmin as any)
    .from('pharmacy_onboarding')
    .select('invite_token, tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!onboarding?.invite_token) return { ok: false, error: 'No invite token found.' }

  const { data: tenant } = await (supabaseAdmin as any)
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const { data: profile } = await (supabaseAdmin as any)
    .from('profiles')
    .select('email, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'pharmacy_admin')
    .maybeSingle()

  if (!profile?.email) return { ok: false, error: 'Admin email not found.' }

  // Extend expiry by 72h
  const newExpiry = new Date()
  newExpiry.setHours(newExpiry.getHours() + 72)
  await (supabaseAdmin as any)
    .from('pharmacy_onboarding')
    .update({ invite_expires_at: newExpiry.toISOString() })
    .eq('tenant_id', tenantId)

  const baseUrl = process.env.PHARMACY_APP_URL ?? 'https://pharmacy.synapseos.tech'
  const inviteUrl = `${baseUrl}/invite/${onboarding.invite_token}`
  const firstName = profile.full_name?.split(' ')[0] ?? 'there'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    'Synapse OS <noreply@synapseos.tech>',
    to:      profile.email,
    subject: `Reminder: Set up ${tenant?.name ?? 'your pharmacy'} on Synapse`,
    html:    `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2>Your Synapse Pharmacy invite</h2>
        <p>Hi ${firstName}, here is your invite link to set up ${tenant?.name ?? 'your pharmacy'}:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Set Up My Account
        </a>
        <p style="color:#666;font-size:12px;">${inviteUrl}</p>
      </div>
    `,
  })

  return { ok: true }
}

export async function setTenantStatus(tenantId: string, status: 'active' | 'suspended'): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin()
  const { error } = await (supabaseAdmin as any)
    .from('tenants')
    .update({ status, is_active: status === 'active' })
    .eq('id', tenantId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

- [ ] **Step 4: Verify build**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web; npm run build 2>&1 | Select-Object -Last 8
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/ apps/web/src/app/platform/tenants/provision/
git commit -m "feat(platform): tenant detail with onboarding progress, resend invite, activate/suspend"
```

---

## Self-Review

**Spec coverage:**
- ✅ Provision → invite email (Task 3, 4)
- ✅ Pharmacy stats on overview (Task 2)
- ✅ Sidebar navigation (Task 1)
- ✅ Tenant detail: onboarding progress + resend invite + activate/suspend (Task 5)
- ✅ Invite URL shown on provision success (Task 4)

**Not in scope this plan:**
- Billing/subscription UI (deferred — free trial only)
- Audit log enhancements
- Feature flags changes
