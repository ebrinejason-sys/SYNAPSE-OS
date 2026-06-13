# Shared Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@synapse/db` with an admin client and audit logging, add a constants export to `@synapse/config`, and create two new packages — `@synapse/email` (Resend delivery) and `@synapse/auth` (JWT sessions, OTP, bcrypt passwords, server context) — so that `apps/web` and `apps/pharmacy` can both import shared auth and email logic.

**Architecture:** Three existing packages (`@synapse/db`, `@synapse/config`, `@synapse/ui`) get extended without breaking their current exports. Two new packages (`@synapse/email`, `@synapse/auth`) are added to `packages/`. All packages are TypeScript-only (no build step — Next.js transpiles them via `moduleResolution: bundler`). `@synapse/auth` depends on `@synapse/db` (for `supabaseAdmin`) and `node:crypto`. `@synapse/email` depends on the `resend` npm package.

**Tech Stack:** TypeScript 5, `@supabase/supabase-js` v2, `@supabase/ssr` v0.5, `jose` v5, `bcryptjs` v2, `resend` v3+, Node.js `crypto`

---

## Sweep findings incorporated

- `packages/db` name is `@synapse/db` — keep this name (already used by `apps/web`)
- `packages/config` is ESM, exports only `./tailwind` — needs new `./constants` export
- `apps/web/src/lib/resend.ts` has production-quality branded email HTML — extract into `@synapse/email`
- `apps/web/src/lib/otp.ts` has `generateOtp` / `hashOtp` / `verifyOtpHash` — replicate in `@synapse/auth`
- `apps/web/src/lib/supabase/server.ts` has `createServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY` — this becomes `packages/db/src/admin.ts`
- No `jose` or `bcryptjs` in any package.json yet — must be added to `packages/auth`
- `apps/pharmacy` already has `resend` dependency — will import from `@synapse/email` after this plan
- `packages/auth` will not have any Next.js imports in `tokens.ts`, `sessions.ts`, `otp.ts`, `password.ts` (safe for Expo later). The `context.server.ts` file uses `next/headers` and is explicitly for Next.js only.

---

## File Map

**Modify:**
- `packages/db/src/index.ts` — add admin + audit exports
- `packages/db/package.json` — add `./admin` export entry

**Create:**
- `packages/db/src/admin.ts`
- `packages/db/src/audit.ts`
- `packages/config/src/constants.ts`
- `packages/config/package.json` — add `./constants` export entry (modify)
- `packages/email/package.json`
- `packages/email/src/client.ts`
- `packages/email/src/templates.ts`
- `packages/email/src/send.ts`
- `packages/email/src/index.ts`
- `packages/auth/package.json`
- `packages/auth/src/tokens.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/otp.ts`
- `packages/auth/src/sessions.ts`
- `packages/auth/src/context.server.ts`
- `packages/auth/src/index.ts`

---

## Task 1: Admin client in `@synapse/db`

**Files:**
- Create: `packages/db/src/admin.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Read current `packages/db/src/index.ts` and `packages/db/package.json`**

```
packages/db/src/index.ts currently exports: types + client (browser + server)
packages/db/package.json exports: ".", "./client", "./types"
```

- [ ] **Step 2: Create `packages/db/src/admin.ts`**

```typescript
// packages/db/src/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SYNAPSE] supabaseAdmin must never be imported in browser/client code. ' +
    'Import from @synapse/db/admin in server actions and API routes only.'
  )
}

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-synapse-client': 'service-role' } },
  }
)
```

- [ ] **Step 3: Add admin export to `packages/db/src/index.ts`**

Append to the end of the existing file (do not remove existing exports):

```typescript
export { supabaseAdmin } from './admin'
```

- [ ] **Step 4: Add `./admin` to `packages/db/package.json` exports**

Current exports object:
```json
{
  ".": "./src/index.ts",
  "./client": "./src/client.ts",
  "./types": "./src/types.ts"
}
```
Add one line to become:
```json
{
  ".": "./src/index.ts",
  "./client": "./src/client.ts",
  "./types": "./src/types.ts",
  "./admin": "./src/admin.ts"
}
```

- [ ] **Step 5: Verify type-check passes for `packages/db`**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
npx tsc --noEmit -p packages/db/tsconfig.json 2>&1
```

Expected: no errors (or file not found for tsconfig — in that case, `apps/web` build will validate it)

- [ ] **Step 6: Verify `apps/web` still builds**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web
npm run build 2>&1 | Select-Object -Last 20
```

Expected: `Build complete` / `Compiled successfully` with no errors

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/db/src/admin.ts packages/db/src/index.ts packages/db/package.json
git commit -m "feat(db): add supabaseAdmin service-role client to @synapse/db"
```

---

## Task 2: Audit logging in `@synapse/db`

**Files:**
- Create: `packages/db/src/audit.ts`
- Modify: `packages/db/src/index.ts` (append export)

- [ ] **Step 1: Create `packages/db/src/audit.ts`**

```typescript
// packages/db/src/audit.ts
import { supabaseAdmin } from './admin'

export interface AuditEntry {
  actor_id?: string
  actor_email?: string
  action: string
  resource_type: string
  resource_id?: string
  resource_name?: string
  tenant_id?: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  app_surface?: 'web' | 'pharmacy' | 'mobile' | 'api'
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[AUDIT FAILED]', entry.action, error)
  }
}

export async function logPHIAccess(params: {
  accessor_id: string
  accessor_role: string
  patient_id: string
  record_type: string
  access_reason?: string
  tenant_id: string
}): Promise<void> {
  try {
    await supabaseAdmin.from('phi_access_log').insert({
      ...params,
      accessed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[PHI AUDIT FAILED]', error)
  }
}
```

- [ ] **Step 2: Append to `packages/db/src/index.ts`**

```typescript
export { logAudit, logPHIAccess } from './audit'
export type { AuditEntry } from './audit'
```

- [ ] **Step 3: Verify `apps/web` build still passes**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web && npm run build 2>&1 | Select-Object -Last 5
```

Expected: no errors

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/db/src/audit.ts packages/db/src/index.ts
git commit -m "feat(db): add logAudit and logPHIAccess to @synapse/db"
```

---

## Task 3: Constants export in `@synapse/config`

**Files:**
- Create: `packages/config/src/constants.ts`
- Modify: `packages/config/package.json`

- [ ] **Step 1: Create `packages/config/src/` directory and `constants.ts`**

```typescript
// packages/config/src/constants.ts

export const UGANDA_DISTRICTS = [
  'Abim','Adjumani','Agago','Alebtong','Amolatar','Amudat','Amuria',
  'Amuru','Apac','Arua','Budaka','Bududa','Bugiri','Bugweri','Buhweju',
  'Buikwe','Bukedea','Bukomansimbi','Bukwo','Bulambuli','Buliisa',
  'Bundibugyo','Bunyangabu','Bushenyi','Busia','Butaleja','Butebo',
  'Buvuma','Buyende','Dokolo','Gomba','Gulu','Hoima','Ibanda',
  'Iganga','Isingiro','Jinja','Kaabong','Kabale','Kabarole','Kaberamaido',
  'Kagadi','Kakumiro','Kalangala','Kaliro','Kalungu','Kampala','Kamuli',
  'Kamwenge','Kanungu','Kapchorwa','Kapelebyong','Karenga','Kasanda',
  'Kasese','Katakwi','Kayunga','Kazo','Kibale','Kiboga','Kibuku',
  'Kikuube','Kiruhura','Kiryandongo','Kisoro','Kitagwenda','Kitgum',
  'Koboko','Kole','Kotido','Kumi','Kwania','Kyankwanzi','Kyegegwa',
  'Kyenjojo','Kyotera','Lamwo','Lira','Luuka','Luwero','Lwengo',
  'Lyantonde','Madi-Okollo','Manafwa','Maracha','Masaka','Masindi',
  'Mayuge','Mbale','Mbarara','Mitooma','Mityana','Moroto','Moyo',
  'Mpigi','Mubende','Mukono','Nabilatuk','Nakapiripirit','Nakaseke',
  'Nakasongola','Namayingo','Namisindwa','Namutumba','Napak','Nebbi',
  'Ngora','Ntoroko','Ntungamo','Nwoya','Obongi','Omoro','Otuke',
  'Oyam','Pader','Pakwach','Pallisa','Rakai','Rubanda','Rubirizi',
  'Rukiga','Rukungiri','Rwampara','Sembabule','Serere','Sheema',
  'Sironko','Soroti','Tororo','Wakiso','Yumbe','Zombo',
] as const

export type UgandaDistrict = typeof UGANDA_DISTRICTS[number]

export const FACILITY_TYPES = [
  'hospital','clinic','pharmacy','laboratory',
  'imaging_center','dental','mental_health','care_home',
] as const

export type FacilityType = typeof FACILITY_TYPES[number]

export const ALL_ROLES = [
  'platform_admin',
  'hospital_admin','doctor','nurse','clinical_officer',
  'pharmacist','pharmacy_admin','pharmacy_cashier','pharmacy_store_manager',
  'lab_scientist','lab_admin',
  'radiologist','imaging_admin',
  'receptionist','billing_officer','insurance_officer',
  'patient',
] as const

export type SynapseRole = typeof ALL_ROLES[number]

export const PHARMACY_ROLES = [
  'pharmacy_admin','pharmacist','pharmacy_cashier','pharmacy_store_manager',
] satisfies SynapseRole[]

export const CLINICAL_ROLES = [
  'doctor','nurse','clinical_officer','radiologist',
] satisfies SynapseRole[]

export type AppSurface = 'web' | 'pharmacy' | 'mobile'

export const SESSION_COOKIE = 'synapse_session'
export const SESSION_DURATION_DAYS = 7
```

- [ ] **Step 2: Modify `packages/config/package.json` to add `./constants` export**

Read the current file first — it currently has:
```json
{
  "name": "@synapse/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./tailwind": "./tailwind.ts",
    "./typescript": "./tsconfig.json"
  }
}
```

Add the constants entry:
```json
{
  "name": "@synapse/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./tailwind": "./tailwind.ts",
    "./typescript": "./tsconfig.json",
    "./constants": "./src/constants.ts"
  }
}
```

- [ ] **Step 3: Verify `apps/web` build still passes**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web && npm run build 2>&1 | Select-Object -Last 5
```

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/config/src/constants.ts packages/config/package.json
git commit -m "feat(config): add Uganda districts, roles, and constants export"
```

---

## Task 4: Create `packages/email`

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/src/client.ts`
- Create: `packages/email/src/templates.ts`
- Create: `packages/email/src/send.ts`
- Create: `packages/email/src/index.ts`

The email templates are extracted from `apps/web/src/lib/resend.ts` (which already exists and is good). We replicate the HTML-building approach there — we do NOT modify `apps/web/src/lib/resend.ts` in this task (that happens in the auth-migration plan).

- [ ] **Step 1: Create `packages/email/package.json`**

```json
{
  "name": "@synapse/email",
  "version": "1.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "resend": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install email package dependency**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
npm install --workspace=packages/email resend@latest
```

Expected: `resend` added to `packages/email/package.json`

- [ ] **Step 3: Create `packages/email/src/client.ts`**

```typescript
// packages/email/src/client.ts
import { Resend } from 'resend'

let _client: Resend | null = null

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('[SYNAPSE] RESEND_API_KEY is not set')
  _client ??= new Resend(key)
  return _client
}

export const FROM_ADDRESS = 'Synapse Health <noreply@synapseos.tech>'
export const SUPPORT_EMAIL = 'support@synapseos.tech'

const ORANGE = '#F97316'
const GOLD = '#E8B84B'
const DARK = '#07070A'
const SURFACE = '#111117'
const BORDER = 'rgba(255,255,255,0.1)'
const MUTED = '#A0A0B0'
const DIM = '#60607A'

export function brandedHtml(body: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `<p style="margin:0 0 6px;font-size:12px;color:${DIM};">
        Synapse Health Technologies Ltd · Kampala, Uganda<br/>
        <a href="https://synapseos.tech" style="color:${ORANGE};text-decoration:none;">synapseos.tech</a>
        &nbsp;·&nbsp;
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${DIM};text-decoration:none;">${SUPPORT_EMAIL}</a>
       </p>
       <p style="margin:0;font-size:11px;color:${DIM};">
         <a href="${unsubscribeUrl}" style="color:${DIM};text-decoration:underline;">Unsubscribe</a>
       </p>`
    : `<p style="margin:0;font-size:12px;color:${DIM};">
        Synapse Health Technologies Ltd · Kampala, Uganda<br/>
        <a href="https://synapseos.tech" style="color:${ORANGE};text-decoration:none;">synapseos.tech</a>
        &nbsp;·&nbsp;
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${DIM};text-decoration:none;">${SUPPORT_EMAIL}</a>
       </p>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:${DARK};font-family:Arial,sans-serif;color:#F5F5F7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${DARK};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:${SURFACE};border-radius:16px;border:1px solid ${BORDER};overflow:hidden;max-width:600px;">
        <tr><td style="background:linear-gradient(135deg,${ORANGE},${GOLD});padding:4px 0;"></td></tr>
        <tr>
          <td style="padding:32px 40px 24px;">
            <div style="margin-bottom:24px;">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;">
                <span style="color:${ORANGE};">Synapse</span><span style="color:${GOLD};">OS</span>
              </span>
            </div>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            ${footer}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 4: Create `packages/email/src/templates.ts`**

```typescript
// packages/email/src/templates.ts
import { brandedHtml } from './client'

const ORANGE = '#F97316'
const MUTED = '#A0A0B0'
const DIM = '#60607A'

export function otpHtml(params: {
  name: string
  otp: string
  purpose: 'login' | 'verify' | 'reset'
  expiryMinutes?: number
}): string {
  const verb = { login: 'sign in', verify: 'verify your email', reset: 'reset your password' }[params.purpose]
  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F5F7;">Your verification code</h2>
    <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 28px;">
      Hello ${params.name || 'there'},<br/>
      Use this code to ${verb}. It expires in
      <strong style="color:#F5F5F7;">${params.expiryMinutes ?? 10} minutes</strong>.
    </p>
    <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);
                border-radius:12px;padding:28px 20px;text-align:center;margin-bottom:28px;">
      <span style="font-family:monospace;font-size:42px;font-weight:700;
                   letter-spacing:0.25em;color:${ORANGE};">${params.otp}</span>
    </div>
    <p style="font-size:13px;color:${DIM};margin:0;">
      Never share this code. Synapse will never ask for it by phone or chat.<br/>
      If you didn't request this, you can safely ignore this email.
    </p>
  `)
}

export function inviteHtml(params: {
  name: string
  facilityName: string
  role: string
  inviteUrl: string
  tempPassword?: string
}): string {
  const passBlock = params.tempPassword ? `
    <p style="color:${MUTED};margin:0 0 8px;font-size:13px;">Your temporary password:</p>
    <p style="font-family:monospace;font-size:18px;color:#E8B84B;background:#1A1A24;
              padding:12px;border-radius:6px;margin:0 0 8px;">${params.tempPassword}</p>
    <p style="color:#EF4444;font-size:12px;margin:0 0 16px;">
      ⚠ Change this password immediately after first login.
    </p>` : ''

  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F5F5F7;">
      You've been added to ${params.facilityName}
    </h2>
    <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:0 0 8px;">
      Hello ${params.name},<br/>
      You have been enrolled as a <strong style="color:${ORANGE};">${params.role}</strong>
      at <strong style="color:#F5F5F7;">${params.facilityName}</strong> on the Synapse Health platform.
    </p>
    <div style="background:#1A1A24;border:1px solid rgba(255,255,255,0.08);border-radius:10px;
                padding:20px;margin:20px 0;">
      ${passBlock}
      <a href="${params.inviteUrl}"
         style="display:inline-block;background:${ORANGE};color:#07070A;font-weight:700;
                font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Set Up Your Account →
      </a>
      <p style="color:${DIM};font-size:12px;margin:12px 0 0;">This link expires in 48 hours.</p>
    </div>
  `)
}

export function passwordResetHtml(params: { name: string; resetUrl: string }): string {
  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F5F5F7;">Reset your password</h2>
    <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0 0 24px;">
      Hello ${params.name || 'there'},<br/>
      We received a request to reset your Synapse password.
    </p>
    <a href="${params.resetUrl}"
       style="display:inline-block;background:${ORANGE};color:#07070A;font-weight:700;
              font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Reset Password →
    </a>
    <p style="color:#60607A;font-size:12px;margin:16px 0 0;">
      This link expires in 15 minutes. If you didn't request this, ignore this email.
    </p>
  `)
}

export function welcomeHtml(params: { name: string }): string {
  return brandedHtml(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">
      Welcome, ${params.name.split(' ')[0]}. Your account is ready.
    </h2>
    <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 20px;">
      You've successfully joined Synapse OS — Africa's sovereign AI-powered health platform.
    </p>
    <a href="https://synapseos.tech/health/dashboard"
       style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;
              font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Open Dashboard →
    </a>
  `)
}
```

- [ ] **Step 5: Create `packages/email/src/send.ts`**

```typescript
// packages/email/src/send.ts
import { getResend, FROM_ADDRESS } from './client'
import { otpHtml, inviteHtml, passwordResetHtml, welcomeHtml } from './templates'

export async function sendOTP(params: {
  to: string
  name: string
  otp: string
  purpose: 'login' | 'verify' | 'reset'
}): Promise<void> {
  const subjects = {
    login: 'Your Synapse sign-in code',
    verify: 'Verify your Synapse account',
    reset: 'Reset your Synapse password',
  }
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: subjects[params.purpose],
    html: otpHtml(params),
  })
}

export async function sendInvite(params: {
  to: string
  name: string
  facilityName: string
  role: string
  inviteUrl: string
  tempPassword?: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `You've been enrolled on Synapse — ${params.facilityName}`,
    html: inviteHtml(params),
  })
}

export async function sendPasswordReset(params: {
  to: string
  name: string
  resetUrl: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: 'Reset your Synapse password',
    html: passwordResetHtml(params),
  })
}

export async function sendWelcome(params: {
  to: string
  name: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Welcome to Synapse OS, ${params.name.split(' ')[0]}`,
    html: welcomeHtml(params),
  })
}
```

- [ ] **Step 6: Create `packages/email/src/index.ts`**

```typescript
export { sendOTP, sendInvite, sendPasswordReset, sendWelcome } from './send'
export { otpHtml, inviteHtml, passwordResetHtml, welcomeHtml } from './templates'
export { brandedHtml, FROM_ADDRESS } from './client'
```

- [ ] **Step 7: Add `@synapse/email` to `apps/web` and `apps/pharmacy` dependencies**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
npm pkg set dependencies.@synapse/email="*" --workspace=apps/web
npm pkg set dependencies.@synapse/email="*" --workspace=apps/pharmacy
npm install
```

- [ ] **Step 8: Verify `apps/web` build still passes**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web && npm run build 2>&1 | Select-Object -Last 5
```

- [ ] **Step 9: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/email/ apps/web/package.json apps/pharmacy/package.json package-lock.json
git commit -m "feat(email): create @synapse/email package with Resend templates"
```

---

## Task 5: Create `packages/auth` — tokens & password

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/src/tokens.ts`
- Create: `packages/auth/src/password.ts`

- [ ] **Step 1: Create `packages/auth/package.json`**

```json
{
  "name": "@synapse/auth",
  "version": "1.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./context": "./src/context.server.ts"
  },
  "dependencies": {
    "@synapse/db": "*",
    "@synapse/config": "*",
    "jose": "^5.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

- [ ] **Step 2: Install auth dependencies**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
npm install --workspace=packages/auth jose bcryptjs
npm install --workspace=packages/auth --save-dev @types/bcryptjs
```

- [ ] **Step 3: Create `packages/auth/src/tokens.ts`**

```typescript
// packages/auth/src/tokens.ts
// No Next.js imports — safe for Expo and Node.js

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const ISSUER = 'synapse-health-technologies'
const AUDIENCE = 'synapse-platform'

function getSecret(): Uint8Array {
  const secret = process.env.SYNAPSE_JWT_SECRET
  if (!secret) throw new Error('[SYNAPSE] SYNAPSE_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export interface SynapseTokenPayload extends JWTPayload {
  sub: string
  email: string
  role: string
  tenant_id: string
  app: 'web' | 'pharmacy' | 'mobile'
  synapse_id?: string
}

export async function signToken(
  payload: Omit<SynapseTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
  expiresIn: string = '7d'
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<SynapseTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  return payload as SynapseTokenPayload
}

export async function signShortToken(params: {
  sub: string
  purpose: 'reset' | 'verify' | 'invite'
}): Promise<string> {
  return new SignJWT(params)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('15m')
    .sign(getSecret())
}

export async function verifyShortToken(
  token: string,
  purpose: 'reset' | 'verify' | 'invite'
): Promise<{ sub: string; purpose: string }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (payload['purpose'] !== purpose) {
    throw new Error(`Token purpose mismatch: expected ${purpose}, got ${String(payload['purpose'])}`)
  }
  return payload as { sub: string; purpose: string }
}
```

- [ ] **Step 4: Create `packages/auth/src/password.ts`**

```typescript
// packages/auth/src/password.ts
// No Next.js imports — safe for all runtimes

import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (password.length < 8) errors.push('At least 8 characters required')
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter required')
  if (!/[0-9]/.test(password)) errors.push('At least one number required')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character required')
  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/auth/ package-lock.json
git commit -m "feat(auth): add @synapse/auth package with JWT tokens and bcrypt password helpers"
```

---

## Task 6: `packages/auth` — OTP and sessions

**Files:**
- Create: `packages/auth/src/otp.ts`
- Create: `packages/auth/src/sessions.ts`

- [ ] **Step 1: Create `packages/auth/src/otp.ts`**

This replicates the logic from `apps/web/src/lib/otp.ts` and the API route `api/auth/email-otp/send/route.ts`, but moves it into the shared package so pharmacy can also use it.

```typescript
// packages/auth/src/otp.ts
// Uses existing auth_otps table (already in DB)

import { createHash, timingSafeEqual, randomInt } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'

export function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

export function hashOTP(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

export function verifyOTPHash(input: string, stored: string): boolean {
  try {
    const a = Buffer.from(hashOTP(input), 'hex')
    const b = Buffer.from(stored, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const OTP_TTL_MINUTES = 10
const HOURLY_RATE_LIMIT = 3

export async function createAndSendOTP(params: {
  channel: 'email' | 'sms'
  target: string
}): Promise<string> {
  // Rate limit: max 3 OTPs per hour per target
  const { count } = await supabaseAdmin
    .from('auth_otps')
    .select('*', { count: 'exact', head: true })
    .eq('target', params.target)
    .eq('channel', params.channel)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if ((count ?? 0) >= HOURLY_RATE_LIMIT) {
    throw new Error('TOO_MANY_REQUESTS')
  }

  const otp = generateOTP()
  const otpHash = hashOTP(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('auth_otps')
    .insert({
      channel: params.channel,
      target: params.target,
      otp_hash: otpHash,
      expires_at: expiresAt,
    })

  if (error) throw new Error(`OTP insert failed: ${error.message}`)
  return otp
}

export async function verifyOTP(params: {
  target: string
  otp: string
}): Promise<{ valid: boolean; error?: 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND' }> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('auth_otps')
    .select('id, otp_hash, attempts, expires_at')
    .eq('target', params.target)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchErr || !row) return { valid: false, error: 'NOT_FOUND' }
  if (row.attempts >= 5) return { valid: false, error: 'TOO_MANY_ATTEMPTS' }

  await supabaseAdmin
    .from('auth_otps')
    .update({ attempts: row.attempts + 1 })
    .eq('id', row.id)

  if (!verifyOTPHash(params.otp, row.otp_hash)) {
    return { valid: false, error: 'INVALID' }
  }

  await supabaseAdmin.from('auth_otps').update({ used: true }).eq('id', row.id)
  return { valid: true }
}
```

- [ ] **Step 2: Create `packages/auth/src/sessions.ts`**

This requires the `synapse_sessions` table — run the DB migration plan first (or mock it in step 3).

```typescript
// packages/auth/src/sessions.ts
// Requires: synapse_sessions table (see database-migrations plan, Task 1)

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_DURATION_DAYS } from '@synapse/config/constants'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(params: {
  userId: string
  token: string
  app: 'web' | 'pharmacy' | 'mobile'
  ip?: string
  userAgent?: string
}): Promise<void> {
  const tokenHash = hashToken(params.token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const { error } = await supabaseAdmin.from('synapse_sessions').insert({
    user_id: params.userId,
    token_hash: tokenHash,
    app: params.app,
    ip_address: params.ip,
    user_agent: params.userAgent,
    expires_at: expiresAt.toISOString(),
  })

  if (error) throw new Error(`Session creation failed: ${error.message}`)
}

export async function validateSession(
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  const tokenHash = hashToken(token)
  const { data } = await supabaseAdmin
    .from('synapse_sessions')
    .select('user_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!data) return { valid: false }
  if (data.revoked_at) return { valid: false }
  if (new Date(data.expires_at as string) < new Date()) return { valid: false }

  return { valid: true, userId: data.user_id as string }
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await supabaseAdmin
    .from('synapse_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await supabaseAdmin
    .from('synapse_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
}
```

- [ ] **Step 3: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/auth/src/otp.ts packages/auth/src/sessions.ts
git commit -m "feat(auth): add OTP create/verify and session management to @synapse/auth"
```

---

## Task 7: `packages/auth` — server context and index

**Files:**
- Create: `packages/auth/src/context.server.ts`
- Create: `packages/auth/src/index.ts`

- [ ] **Step 1: Create `packages/auth/src/context.server.ts`**

This uses `next/headers` — it is **only** safe for Next.js server components and server actions.

```typescript
// packages/auth/src/context.server.ts
// NEXT.JS ONLY — server components and server actions

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, type SynapseTokenPayload } from './tokens'
import { validateSession } from './sessions'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, type AppSurface, type SynapseRole } from '@synapse/config/constants'

export interface SynapseContext {
  user: {
    id: string
    email: string
    role: SynapseRole
    fullName: string | null
    firstName: string | null
    lastName: string | null
    tenantId: string
    synapseId: string | null
    avatarUrl: string | null
    isAdmin: boolean
    onboardingComplete: boolean
    verificationStatus: string | null
    mustChangePassword: boolean
  }
  tenant: {
    id: string
    name: string
    slug: string
    facilityType: string
    status: string
    plan: string
    modulesEnabled: string[]
    isNetworkMember: boolean
    onboardingCompleted: boolean
  }
  app: AppSurface
  token: string
}

export async function getContext(
  app: AppSurface = 'web',
  redirectTo = '/login'
): Promise<SynapseContext> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) redirect(redirectTo)

  let payload: SynapseTokenPayload
  try {
    payload = await verifyToken(token)
  } catch {
    redirect(redirectTo)
  }

  const { valid } = await validateSession(token)
  if (!valid) redirect(redirectTo)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(`
      id, email, role, full_name, first_name, last_name,
      tenant_id, synapse_id, is_admin, onboarding_complete,
      verification_status, avatar_url, must_change_password
    `)
    .eq('id', payload.sub)
    .single()

  if (profileError || !profile) redirect(redirectTo)

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select(`
      id, name, slug, facility_type, status, plan,
      modules_enabled, is_network_member, onboarding_completed
    `)
    .eq('id', profile.tenant_id as string)
    .single()

  if (tenantError || !tenant) redirect(redirectTo)

  return {
    user: {
      id: profile.id as string,
      email: profile.email as string,
      role: profile.role as SynapseRole,
      fullName: profile.full_name as string | null,
      firstName: profile.first_name as string | null,
      lastName: profile.last_name as string | null,
      tenantId: profile.tenant_id as string,
      synapseId: profile.synapse_id as string | null,
      avatarUrl: profile.avatar_url as string | null,
      isAdmin: (profile.is_admin as boolean) ?? false,
      onboardingComplete: (profile.onboarding_complete as boolean) ?? false,
      verificationStatus: profile.verification_status as string | null,
      mustChangePassword: (profile.must_change_password as boolean) ?? false,
    },
    tenant: {
      id: tenant.id as string,
      name: tenant.name as string,
      slug: tenant.slug as string,
      facilityType: tenant.facility_type as string,
      status: tenant.status as string,
      plan: tenant.plan as string,
      modulesEnabled: (tenant.modules_enabled as string[]) ?? [],
      isNetworkMember: (tenant.is_network_member as boolean) ?? false,
      onboardingCompleted: (tenant.onboarding_completed as boolean) ?? false,
    },
    app,
    token,
  }
}

export async function getContextSafe(app: AppSurface = 'web'): Promise<SynapseContext | null> {
  try {
    return await getContext(app, '__synapse_never_redirect__')
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Create `packages/auth/src/index.ts`**

```typescript
// packages/auth/src/index.ts
// Do NOT import context.server from this barrel — it has next/headers
// Import it explicitly: import { getContext } from '@synapse/auth/context'

export { signToken, verifyToken, signShortToken, verifyShortToken } from './tokens'
export type { SynapseTokenPayload } from './tokens'

export { hashPassword, verifyPassword, validatePasswordStrength } from './password'

export {
  createAndSendOTP, verifyOTP,
  generateOTP, hashOTP, verifyOTPHash,
} from './otp'

export {
  createSession, validateSession, revokeSession, revokeAllUserSessions, hashToken,
} from './sessions'
```

- [ ] **Step 3: Add `@synapse/auth` to `apps/web` and `apps/pharmacy` dependencies**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
npm pkg set dependencies.@synapse/auth="*" --workspace=apps/web
npm pkg set dependencies.@synapse/auth="*" --workspace=apps/pharmacy
npm install
```

- [ ] **Step 4: Verify `apps/web` type-check passes**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web && npm run type-check 2>&1 | Select-Object -Last 20
```

Expected: no errors related to `@synapse/auth`. (Other pre-existing errors are acceptable.)

- [ ] **Step 5: Verify `apps/web` build passes**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS\apps\web && npm run build 2>&1 | Select-Object -Last 10
```

Expected: `Compiled successfully` or equivalent — no new errors introduced by this plan.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\ebrin\SYNAPSE-OS
git add packages/auth/src/context.server.ts packages/auth/src/index.ts \
  apps/web/package.json apps/pharmacy/package.json package-lock.json
git commit -m "feat(auth): complete @synapse/auth package with server context and exports"
```

---

## Self-Review

**Spec coverage:**
- ✅ `@synapse/db` admin client — Task 1
- ✅ `@synapse/db` audit logging — Task 2
- ✅ `@synapse/config` constants (districts, roles, app constants) — Task 3
- ✅ `@synapse/email` package with templates — Task 4
- ✅ `@synapse/auth` JWT tokens and bcrypt — Task 5
- ✅ `@synapse/auth` OTP using `auth_otps` table — Task 6
- ✅ `@synapse/auth` sessions using `synapse_sessions` table — Task 6
- ✅ `@synapse/auth` server context (`getContext`) — Task 7
- ✅ `apps/web` and `apps/pharmacy` wired to new packages — Tasks 4, 7

**Dependencies between plans:**
- `2026-06-12-database-migrations.md` Task 1 (synapse_sessions table) must be run before `packages/auth` sessions work in production
- `2026-06-12-auth-migration.md` depends on this plan being complete

**Notes:**
- `context.server.ts` casts Supabase query results as `unknown` shapes since `@synapse/db` types may not have all columns — this is intentional. TypeScript strict mode is satisfied by the `as` casts and should be replaced with proper typed queries as the `Database` type in `packages/db/src/types.ts` is kept up to date.
- The `sessions.ts` file will fail at runtime (not compile time) if the `synapse_sessions` table doesn't exist — run the DB migrations plan in parallel.
