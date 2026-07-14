# Mobile App Gap Fixes Implementation Plan

> **STATUS: ✅ IMPLEMENTED (verified 2026-07-14).** All six tasks are live on `main`: the three expo deps are in `apps/app/package.json`, ROLE_KIND is synced in `/api/auth/mobile/me`, migration `20260704000001_add_mobile_push_tokens.sql` exists, and all routes (`push-token`, `encounter/[id]`, `records/[id]`, `appointments/[id]`, `medications/[id]`, `inventory/[id]`, `lab`, `claims`) plus `LockScreen` + root-layout wiring exist. Both workspaces type-check clean. Checkboxes below were never ticked — do not re-execute this plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps left by a prior partial implementation of `docs/superpowers/specs/2026-06-22-mobile-app-improvements-design.md` so the Synapse mobile app actually boots, and every already-built role screen loads real data instead of a permanent error/empty state.

**Architecture:** No new architecture — this is finishing wiring that already has a client-side shape (screens, types, navigation) but is missing its backend (API routes, one DB table) and two small pieces of client code (fixed dependency list, a lock-screen consumer for existing state). Every new API route follows the exact auth/response conventions already used by sibling routes (`apps/web/src/app/api/mobile/patients/[id]/route.ts`, `apps/web/src/app/api/mobile/queue/route.ts`, `apps/web/src/app/api/mobile/appointments/route.ts`) — same `verifyToken` → `validateSession` → tenant/ownership-scoped query → camelCase JSON shape.

**Tech Stack:** Expo SDK 52 / React Native 0.76 / expo-router 4 (apps/app); Next.js 15 App Router API routes, `@synapse/auth`, `@synapse/db` (`supabaseAdmin`), Supabase Postgres (apps/web + supabase/migrations).

## Global Constraints

- **No test infrastructure exists in either app** (`apps/app` and `apps/web` both have zero `*.test.*` files; `apps/web/package.json` and `apps/app/package.json` both only define a `type-check` script — no `test` script). Per writing-plans' own rule ("in existing codebases, follow established patterns"), do **not** invent a Jest/Vitest setup for this plan. Every task's verification step is `npm run type-check` in the relevant workspace, plus a manual read-through of the diff against the exact interface the calling screen expects (already extracted below, verbatim, from the actual screen source). Do not add a testing framework as a side effect of this plan.
- Every new/modified Next.js API route file must keep the exact auth boilerplate pattern already used across `apps/web/src/app/api/mobile/*`: extract `Authorization: Bearer <token>` header → `verifyToken(token)` → `validateSession(token)` → 401 on any failure. Copy this block verbatim; do not refactor it into a shared helper as part of this plan (out of scope, and one sibling route already uses a locally-scoped `authUser()` helper instead — follow whichever convention is shown in that task's brief).
- All Supabase queries use `supabaseAdmin` from `@synapse/db/admin`, cast `as any` with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` immediately above (matches every existing route in this directory).
- All new/modified routes scope every query by `tenant_id` (staff-facing) or by the authenticated user's own patient/profile rows (patient-facing) — never return cross-tenant or cross-patient data. Never trust a `tenantId`/`role` value from the request body; always derive from the verified JWT payload (`payload.tenant_id`, `payload.role`, `payload.sub`).
- JSON response bodies use camelCase keys mapped from snake_case DB columns, matching the exact TypeScript interfaces already declared in the calling screen (each task quotes the exact interface — do not add or rename fields).
- Do not invent database columns. Every column name used below was confirmed either by reading a migration/generated-types file directly, or by finding it in a currently-shipping route/page that queries it without swallowing the error. Where the plan says a field must be `null` because no backing column exists, leave it `null` — do not add a migration to backfill it (out of scope).
- Package version pins for new Expo native module dependencies (confirmed compatible with the already-installed `expo` `~52.0.46` / `react-native` `0.76.9`): `expo-notifications@~0.29.13`, `expo-local-authentication@~14.0.1`, `expo-device@~7.0.3`.
- Never run destructive git operations. Never run `npm install` with `--force` or `--legacy-peer-deps` unless a task explicitly says to.
- Commit after each task, following this repo's existing commit style (short imperative subject, `feat(mobile): ...` / `fix(mobile): ...` prefix — see `git log --oneline -5` for examples already in this repo).

---

### Task 1: Fix broken mobile client dependencies and stale role map

**Files:**
- Modify: `apps/app/package.json`
- Modify: `apps/web/src/app/api/auth/mobile/me/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: unblocks `apps/app/lib/auth.tsx`'s existing imports of `expo-notifications`, `expo-local-authentication`, `expo-device` (already written, currently dangling). Produces a corrected `ROLE_KIND` map other tasks do not depend on (dead field today, but must not regress).

- [ ] **Step 1: Add the three missing dependencies to `apps/app/package.json`**

In the `"dependencies"` object, insert these three entries in alphabetical position (matching the file's existing alphabetical ordering):

```json
    "expo-clipboard": "~7.0.0",
    "expo-device": "~7.0.3",
    "expo-local-authentication": "~14.0.1",
```
and
```json
    "expo-linking": "~7.0.5",
    "expo-notifications": "~0.29.13",
    "expo-router": "~4.0.20",
```

The full `"dependencies"` block must read (alphabetical, unchanged entries omitted for brevity — keep every existing line, only add the three new ones in place):

```json
  "dependencies": {
    "@expo-google-fonts/dm-sans": "^0.4.2",
    "@expo/vector-icons": "~14.0.4",
    "@react-native-async-storage/async-storage": "1.23.1",
    "expo": "~52.0.46",
    "expo-clipboard": "~7.0.0",
    "expo-device": "~7.0.3",
    "expo-local-authentication": "~14.0.1",
    "expo-asset": "~11.0.5",
    "expo-build-properties": "~0.13.2",
    "expo-constants": "~17.0.7",
    "expo-font": "~13.0.4",
    "expo-image": "~2.0.7",
    "expo-linear-gradient": "~14.0.2",
    "expo-linking": "~7.0.5",
    "expo-notifications": "~0.29.13",
    "expo-router": "~4.0.20",
    "expo-secure-store": "~14.0.1",
    "expo-splash-screen": "~0.29.22",
    "expo-status-bar": "~2.0.1",
    "react": "18.3.1",
    "react-native": "0.76.9",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-reanimated": "~3.16.7",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0"
  },
```

(The alphabetical grouping already in the file isn't strict — `expo-asset` sorts after `expo-clipboard` in the existing file too — so just insert the three new lines where shown above; don't reorder existing lines.)

- [ ] **Step 2: Install from the repo root (npm workspaces)**

Run: `npm install` from the repo root (`c:\Users\ebrin\SYNAPSE-OS`)
Expected: completes without error; `package-lock.json` gains entries for `expo-device`, `expo-local-authentication`, `expo-notifications` under `apps/app/node_modules/...`.

Verify: `npm ls expo-device expo-local-authentication expo-notifications --workspace=apps/app`
Expected: all three print a resolved version (no `UNMET DEPENDENCY` / `invalid` errors).

- [ ] **Step 3: Fix the stale `ROLE_KIND` map in `apps/web/src/app/api/auth/mobile/me/route.ts`**

Replace the current 11-entry map (lines 5–10) with the canonical map already used by `apps/web/src/app/api/mobile/dashboard/route.ts` (the two must stay in sync — that file's own comment says so):

```ts
const ROLE_KIND: Record<string, string> = {
  patient: 'patient',
  doctor: 'clinician', independent_doctor: 'clinician', clinician: 'clinician',
  clinical_officer: 'clinician', specialist: 'clinician', surgeon: 'clinician',
  anaesthetist: 'clinician', intensivist: 'clinician', cardiologist: 'clinician',
  oncologist: 'clinician', psychiatrist: 'clinician', nephrologist: 'clinician',
  art_clinician: 'clinician', obstetrician: 'clinician', paediatrician: 'clinician',
  radiologist: 'clinician', radiographer: 'clinician',
  nurse: 'nurse', theatre_nurse: 'nurse', icu_nurse: 'nurse',
  hiv_counselor: 'nurse', chw: 'nurse', social_worker: 'nurse',
  pharmacist: 'pharmacy', pharmacy_admin: 'pharmacy', pharmacy_store_manager: 'pharmacy',
  lab_tech: 'lab', lab_technician: 'lab', lab_supervisor: 'lab',
  receptionist: 'reception',
  billing_officer: 'billing', claims_officer: 'billing', insurance_officer: 'billing',
  admin: 'admin', hospital_admin: 'admin', facility_admin: 'admin',
  superadmin: 'admin', super_admin: 'admin', overall_admin: 'admin', platform_admin: 'admin',
}
```

- [ ] **Step 4: Type-check both workspaces**

Run: `npm run type-check --workspace=apps/app`
Expected: exits 0, no errors referencing `expo-notifications`, `expo-local-authentication`, or `expo-device`.

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/app/package.json package-lock.json apps/web/src/app/api/auth/mobile/me/route.ts
git commit -m "fix(mobile): add missing expo native deps and sync stale role map"
```

---

### Task 2: Push notification token infrastructure

**Files:**
- Create: `supabase/migrations/20260704000001_add_mobile_push_tokens.sql`
- Create: `apps/web/src/app/api/mobile/push-token/route.ts`

**Interfaces:**
- Consumes: `apps/app/lib/auth.tsx`'s already-written `registerPushToken(token, role)` / `deregisterPushToken(token)` helpers, which call `POST /api/mobile/push-token` with body `{ token: string, deviceId: string, role: string }` and `DELETE /api/mobile/push-token` with body `{ deviceId: string }` (both already implemented client-side, currently 404ing silently because the route doesn't exist — see `apps/app/lib/auth.tsx:221-234`).
- Produces: `mobile_push_tokens` table, columns `id, user_id, tenant_id, device_id, token, role, created_at, updated_at`, unique on `(user_id, device_id)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260704000001_add_mobile_push_tokens.sql`:

```sql
-- Mobile push notification token registry.
-- One row per (user, device); re-registering the same device updates the token in place.
create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  device_id text not null,
  token text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists mobile_push_tokens_user_id_idx on public.mobile_push_tokens(user_id);
create index if not exists mobile_push_tokens_tenant_id_idx on public.mobile_push_tokens(tenant_id);

alter table public.mobile_push_tokens enable row level security;
-- No public policies: this table is only read/written by server-side routes
-- using the service-role client (supabaseAdmin), which bypasses RLS.
```

- [ ] **Step 2: Write the route**

Create `apps/web/src/app/api/mobile/push-token/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

async function authUser(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return null

  const { valid } = await validateSession(token)
  if (!valid) return null

  return {
    userId: payload.sub as string,
    role: (payload.role as string) ?? '',
    tenantId: (payload.tenant_id as string) || null,
  }
}

export async function POST(req: NextRequest) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { token?: string; deviceId?: string } | null
  if (!body?.token || !body?.deviceId) {
    return NextResponse.json({ error: 'token and deviceId are required' }, { status: 400 })
  }

  const { error } = await db()
    .from('mobile_push_tokens')
    .upsert(
      {
        user_id: user.userId,
        tenant_id: user.tenantId,
        device_id: body.deviceId,
        token: body.token,
        role: user.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { deviceId?: string } | null
  if (!body?.deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
  }

  await db()
    .from('mobile_push_tokens')
    .delete()
    .eq('user_id', user.userId)
    .eq('device_id', body.deviceId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260704000001_add_mobile_push_tokens.sql apps/web/src/app/api/mobile/push-token/route.ts
git commit -m "feat(mobile): add push token registration table and endpoint"
```

---

### Task 3: Encounter detail API route (clinical queue tap-through)

**Files:**
- Create: `apps/web/src/app/api/mobile/encounter/[id]/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: satisfies `apps/app/app/encounter/[id].tsx`'s existing call `apiRequest<{ encounter: EncounterDetail }>(\`/api/mobile/encounter/${id}\`, { token })`, where `EncounterDetail` (already defined client-side, do not change) is:

```ts
interface EncounterDetail {
  encounterId: string
  status: string
  chiefComplaint: string | null
  clinicalStage: string | null
  createdAt: string
  patient: {
    id: string
    fullName: string
    mrn: string | null
    dateOfBirth: string | null
    sex: string | null
    bloodGroup: string | null
  } | null
  vitals: {
    temperature: number | null
    bpSystolic: number | null
    bpDiastolic: number | null
    pulse: number | null
    weight: number | null
    height: number | null
    spo2: number | null
  } | null
  providerName: string | null
}
```

Confirmed DB columns to use (from `packages/db/src/types.ts`, cross-checked against `apps/web/src/app/api/mobile/queue/route.ts` and `apps/web/src/app/api/mobile/patients/[id]/route.ts`, both already working):
- `encounters`: `id, tenant_id, patient_id, chief_complaint, clinical_stage, status, created_at, clinician_id, is_deleted`
- `patients`: `id, tenant_id, full_name, mrn, dob, sex, blood_group, is_deleted`
- `vitals`: `encounter_id, bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, weight_kg, height_cm, recorded_at`
- `profiles`: `id, full_name, first_name, last_name` (for `clinician_id` → provider name lookup)

- [ ] **Step 1: Write the route**

Create `apps/web/src/app/api/mobile/encounter/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const { data: encounter } = await db()
    .from('encounters')
    .select('id, status, chief_complaint, clinical_stage, created_at, patient_id, clinician_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!encounter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [patientRes, vitalsRes, clinicianRes] = await Promise.all([
    encounter.patient_id
      ? db()
          .from('patients')
          .select('id, full_name, mrn, dob, sex, blood_group')
          .eq('id', encounter.patient_id)
          .eq('tenant_id', tenantId)
          .eq('is_deleted', false)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db()
      .from('vitals')
      .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, weight_kg, height_cm')
      .eq('encounter_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1),
    encounter.clinician_id
      ? db()
          .from('profiles')
          .select('full_name, first_name, last_name')
          .eq('id', encounter.clinician_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const patient = patientRes.data
  const vitalsRow = vitalsRes.data?.[0] ?? null
  const clinician = clinicianRes.data

  return NextResponse.json({
    encounter: {
      encounterId: encounter.id,
      status: encounter.status,
      chiefComplaint: encounter.chief_complaint,
      clinicalStage: encounter.clinical_stage,
      createdAt: encounter.created_at,
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.full_name,
            mrn: patient.mrn,
            dateOfBirth: patient.dob,
            sex: patient.sex,
            bloodGroup: patient.blood_group,
          }
        : null,
      vitals: vitalsRow
        ? {
            temperature: vitalsRow.temperature_c,
            bpSystolic: vitalsRow.bp_systolic,
            bpDiastolic: vitalsRow.bp_diastolic,
            pulse: vitalsRow.heart_rate,
            weight: vitalsRow.weight_kg,
            height: vitalsRow.height_cm,
            spo2: vitalsRow.spo2,
          }
        : null,
      providerName: clinician
        ? (clinician.full_name ?? [clinician.first_name, clinician.last_name].filter(Boolean).join(' ')) || null
        : null,
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/mobile/encounter/
git commit -m "feat(mobile): add encounter detail endpoint for queue tap-through"
```

---

### Task 4: Patient-facing detail API routes (records, appointments, medications)

**Files:**
- Create: `apps/web/src/app/api/mobile/records/[id]/route.ts`
- Create: `apps/web/src/app/api/mobile/appointments/[id]/route.ts`
- Create: `apps/web/src/app/api/mobile/medications/[id]/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: satisfies three already-written client screens. Exact interfaces (already defined client-side, do not change):

`apps/app/app/record/[id].tsx` calls `apiRequest<{ record: RecordDetail }>(\`/api/mobile/records/${id}\`, { token })`:
```ts
interface RecordDetail {
  id: string
  type: 'encounter' | 'lab' | 'profile'
  title: string
  subtitle: string | null
  date: string
  meta: string | null
  notes: string | null
  diagnoses: string[]
  vitals: {
    temperature: number | null; bpSystolic: number | null; bpDiastolic: number | null
    pulse: number | null; weight: number | null; spo2: number | null
  } | null
  providerName: string | null
  facilityName: string | null
}
```

`apps/app/app/appointment/[id].tsx` calls `apiRequest<{ appointment: AppointmentDetail }>(\`/api/mobile/appointments/${id}\`, { token })` for GET, and `apiRequest(\`/api/mobile/appointments/${id}\`, { method: 'DELETE', token })` for cancel (no request body, response body ignored):
```ts
interface AppointmentDetail {
  id: string
  scheduledFor: string
  status: string
  chiefComplaint: string | null
  channel: string
  providerName: string | null
  facilityName: string | null
  notes: string | null
  canCancel: boolean
}
```

`apps/app/app/medication/[id].tsx` calls `apiRequest<{ medication: MedicationDetail }>(\`/api/mobile/medications/${id}\`, { token })`:
```ts
interface MedicationDetail {
  id: string
  name: string
  dose: string | null
  frequency: string | null
  notes: string | null
  source: string
  prescribingProvider: string | null
  prescribingEncounterId: string | null
  startDate: string | null
  endDate: string | null
  refillsRemaining: number | null
  indication: string | null
}
```

Confirmed DB columns (same sources as Task 3, plus `apps/web/src/app/api/mobile/records/route.ts`, `apps/web/src/app/api/mobile/appointments/route.ts`, `apps/web/src/app/api/mobile/medications/route.ts` — all already shipping and working, follow their exact query shape):
- `patients`: `id, created_by, is_deleted` (records ownership is via `patients.created_by = userId`, exactly as the existing list route does)
- `encounters`: `id, tenant_id, patient_id, chief_complaint, clinical_stage, status, created_at, clinician_id, is_deleted`
- `lab_results`: `id, patient_id, tenant_id, test_name, result_value, flag, created_at`
- `tenants`: `id, name`
- `telemedicine_appointments`: `id, tenant_id, patient_id, created_by, provider_id, scheduled_for, status, chief_complaint, channel, notes, is_deleted`
- `patient_profiles`: `id, current_medications` (JSON array/object of `{ name, dose, frequency, notes }`, synthetic id `profile-${index}` — same as the existing list route)

- [ ] **Step 1: Write `records/[id]/route.ts`**

The existing list route (`apps/web/src/app/api/mobile/records/route.ts`) merges two sources — `encounters` and `lab_results` — into one list, scoped by `patients.created_by = userId`. The detail route must look up the same `id` in both sources (an id from the "records" list can be an encounter id or a lab_results id) and return whichever type matches. There are no `notes`/`diagnoses` columns on `encounters` in the current schema — leave those `null`/`[]` rather than inventing columns.

Create `apps/web/src/app/api/mobile/records/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string
  const { id } = await params

  const { data: patientRows } = await db()
    .from('patients')
    .select('id')
    .eq('created_by', userId)
    .eq('is_deleted', false)
    .limit(20)

  const patientIds = (patientRows ?? []).map((p: { id: string }) => p.id)
  if (patientIds.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: encounter } = await db()
    .from('encounters')
    .select('id, chief_complaint, clinical_stage, status, created_at, tenant_id, clinician_id')
    .eq('id', id)
    .in('patient_id', patientIds)
    .eq('is_deleted', false)
    .maybeSingle()

  if (encounter) {
    const [tenantRes, vitalsRes, clinicianRes] = await Promise.all([
      encounter.tenant_id
        ? db().from('tenants').select('name').eq('id', encounter.tenant_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db()
        .from('vitals')
        .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, weight_kg, spo2')
        .eq('encounter_id', id)
        .order('recorded_at', { ascending: false })
        .limit(1),
      encounter.clinician_id
        ? db().from('profiles').select('full_name, first_name, last_name').eq('id', encounter.clinician_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const facilityName = tenantRes.data?.name ?? null
    const vitalsRow = vitalsRes.data?.[0] ?? null
    const clinician = clinicianRes.data

    return NextResponse.json({
      record: {
        id: encounter.id,
        type: 'encounter',
        title: facilityName ? `Visit at ${facilityName}` : 'Clinical visit',
        subtitle: encounter.chief_complaint,
        date: encounter.created_at,
        meta: encounter.status,
        notes: null,
        diagnoses: [],
        vitals: vitalsRow
          ? {
              temperature: vitalsRow.temperature_c,
              bpSystolic: vitalsRow.bp_systolic,
              bpDiastolic: vitalsRow.bp_diastolic,
              pulse: vitalsRow.heart_rate,
              weight: vitalsRow.weight_kg,
              spo2: vitalsRow.spo2,
            }
          : null,
        providerName: clinician
          ? (clinician.full_name ?? [clinician.first_name, clinician.last_name].filter(Boolean).join(' ')) || null
          : null,
        facilityName,
      },
    })
  }

  const { data: lab } = await db()
    .from('lab_results')
    .select('id, test_name, result_value, flag, created_at, tenant_id')
    .eq('id', id)
    .in('patient_id', patientIds)
    .maybeSingle()

  if (lab) {
    const tenantRes = lab.tenant_id
      ? await db().from('tenants').select('name').eq('id', lab.tenant_id).maybeSingle()
      : { data: null }

    return NextResponse.json({
      record: {
        id: lab.id,
        type: 'lab',
        title: lab.test_name ?? 'Lab result',
        subtitle: lab.result_value ? String(lab.result_value) : null,
        date: lab.created_at,
        meta: lab.flag,
        notes: null,
        diagnoses: [],
        vitals: null,
        providerName: null,
        facilityName: tenantRes.data?.name ?? null,
      },
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```

- [ ] **Step 2: Write `appointments/[id]/route.ts` (GET + DELETE)**

`canCancel` mirrors the spec: upcoming (not already cancelled/completed) and more than 2 hours away.

Create `apps/web/src/app/api/mobile/appointments/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const TERMINAL_STATUSES = ['cancelled_by_patient', 'cancelled_by_provider', 'cancelled', 'completed']
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

async function authUser(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return null

  const { valid } = await validateSession(token)
  if (!valid) return null

  return {
    userId: payload.sub as string,
    role: (payload.role as string) ?? '',
    tenantId: (payload.tenant_id as string) || '',
  }
}

function canCancel(status: string, scheduledFor: string): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false
  return new Date(scheduledFor).getTime() - Date.now() > TWO_HOURS_MS
}

async function loadAppointment(user: { userId: string; role: string; tenantId: string }, id: string) {
  let query = db()
    .from('telemedicine_appointments')
    .select('id, scheduled_for, status, chief_complaint, channel, notes, tenant_id, provider_id, created_by, patient_id')
    .eq('id', id)
    .eq('is_deleted', false)

  query = user.role === 'patient'
    ? query.or(`created_by.eq.${user.userId},patient_id.eq.${user.userId}`)
    : query.eq('tenant_id', user.tenantId)

  const { data } = await query.maybeSingle()
  return data
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appt = await loadAppointment(user, id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [providerRes, tenantRes] = await Promise.all([
    appt.provider_id
      ? db().from('profiles').select('full_name, first_name, last_name').eq('id', appt.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    appt.tenant_id
      ? db().from('tenants').select('name').eq('id', appt.tenant_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const provider = providerRes.data
  const providerName = provider
    ? (provider.full_name ?? [provider.first_name, provider.last_name].filter(Boolean).join(' ')) || null
    : null

  return NextResponse.json({
    appointment: {
      id: appt.id,
      scheduledFor: appt.scheduled_for,
      status: appt.status,
      chiefComplaint: appt.chief_complaint,
      channel: appt.channel ?? 'video',
      providerName,
      facilityName: tenantRes.data?.name ?? null,
      notes: appt.notes,
      canCancel: canCancel(appt.status, appt.scheduled_for),
    },
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appt = await loadAppointment(user, id)
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!canCancel(appt.status, appt.scheduled_for)) {
    return NextResponse.json({ error: 'This appointment can no longer be cancelled' }, { status: 400 })
  }

  const { error } = await db()
    .from('telemedicine_appointments')
    .update({ status: 'cancelled_by_patient' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Write `medications/[id]/route.ts`**

The list route (`apps/web/src/app/api/mobile/medications/route.ts`) synthesizes ids as `profile-${index}` from a JSON blob on `patient_profiles.current_medications` — there is no separate medications table. The detail route re-fetches the same blob and indexes into it. Fields the source data doesn't have (`prescribingProvider`, `prescribingEncounterId`, `startDate`, `endDate`, `refillsRemaining`, `indication`) are honestly `null` — do not fabricate them.

Create `apps/web/src/app/api/mobile/medications/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function parseMedications(value: unknown): Array<{
  name?: string
  dose?: string
  frequency?: string
  notes?: string
}> {
  if (!value) return []
  if (Array.isArray(value)) {
    return value as Array<{ name?: string; dose?: string; frequency?: string; notes?: string }>
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).filter(
      (v) => typeof v === 'object' && v !== null
    ) as Array<{ name?: string; dose?: string; frequency?: string; notes?: string }>
  }
  return []
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string
  const { id } = await params

  const match = /^profile-(\d+)$/.exec(id)
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const index = Number(match[1])

  const { data: profile } = await db()
    .from('patient_profiles')
    .select('current_medications')
    .eq('id', userId)
    .maybeSingle()

  const meds = parseMedications(profile?.current_medications)
  const med = meds[index]
  if (!med) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    medication: {
      id,
      name: med.name ?? 'Unknown medication',
      dose: med.dose ?? null,
      frequency: med.frequency ?? null,
      notes: med.notes ?? null,
      source: 'Health profile',
      prescribingProvider: null,
      prescribingEncounterId: null,
      startDate: null,
      endDate: null,
      refillsRemaining: null,
      indication: null,
    },
  })
}
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/mobile/records/ apps/web/src/app/api/mobile/appointments/ apps/web/src/app/api/mobile/medications/
git commit -m "feat(mobile): add patient-facing detail endpoints for records, appointments, medications"
```

---

### Task 5: Pharmacy, lab, and billing API routes

**Files:**
- Create: `apps/web/src/app/api/mobile/inventory/[id]/route.ts`
- Create: `apps/web/src/app/api/mobile/lab/route.ts`
- Create: `apps/web/src/app/api/mobile/claims/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: satisfies `apps/app/app/stock-item/[id].tsx`, `apps/app/app/(main)/lab.tsx`, `apps/app/app/(main)/claims.tsx` (all already written client-side).

`stock-item/[id].tsx` calls `apiRequest<{ item: StockItemDetail }>(\`/api/mobile/inventory/${id}\`, { token })`:
```ts
interface StockItemDetail {
  id: string
  name: string
  sku: string | null
  category: string | null
  quantity: number
  unit: string | null
  reorderLevel: number
  expiryDate: string | null
  status: 'ok' | 'low' | 'expiring' | 'expired'
  batchNumber: string | null
  shelfLocation: string | null
  unitCost: number | null
  currency: string | null
}
```
Confirmed `pharmacy_products` columns (from `packages/db/src/types.ts`): `id, tenant_id, name, sku, category, quantity, reorder_level, expiry_date, batch_number, cost_price, unit_of_measure, is_active`. There is **no** `shelf_location` or `currency` column — return `shelfLocation: null` and hardcode `currency: 'UGX'` (matches the app-wide currency convention already used in `apps/web/src/app/api/mobile/dashboard/route.ts`'s `money()` helper default).

`lab.tsx` calls `apiRequest<{ orders: LabOrder[]; stats: LabStats }>('/api/mobile/lab', { token })`:
```ts
interface LabOrder {
  id: string
  patientName: string
  patientMrn: string | null
  testName: string
  status: string
  orderedAt: string
  orderedBy: string | null
}
interface LabStats { pending: number; inProgress: number; collected: number }
```
Confirmed columns: `encounter_orders` has `id, tenant_id, encounter_id, order_type, status, name, created_by, created_at` (no confirmed direct `patient_id` column on this table in generated types — join through `encounter_id → encounters.patient_id → patients` instead of guessing a direct column).

`claims.tsx` calls `apiRequest<{ claims: Claim[]; summary: ClaimsSummary }>('/api/mobile/claims', { token })`:
```ts
interface Claim {
  id: string; patientName: string; amount: number; currency: string
  insurer: string | null; status: string; submittedAt: string | null; serviceDate: string | null
}
interface ClaimsSummary { total: number; pending: number; approved: number; rejected: number; totalAmount: number }
```
Confirmed `insurance_claims` columns: `id, tenant_id, patient_id, insurer_name, billed_amount, status, submitted_at, service_from, is_deleted`.

- [ ] **Step 1: Write `inventory/[id]/route.ts`**

Create `apps/web/src/app/api/mobile/inventory/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

type ItemStatus = 'ok' | 'low' | 'expiring' | 'expired'

function classifyProduct(quantity: number, reorderLevel: number, expiryDate: string | null): ItemStatus {
  const today = new Date()
  if (expiryDate) {
    const exp = new Date(expiryDate)
    if (exp < today) return 'expired'
    const days = (exp.getTime() - today.getTime()) / 86400000
    if (days <= 60) return 'expiring'
  }
  if (quantity <= reorderLevel) return 'low'
  return 'ok'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const { data: product } = await db()
    .from('pharmacy_products')
    .select('id, name, sku, category, quantity, reorder_level, expiry_date, batch_number, cost_price, unit_of_measure')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quantity = Number(product.quantity) || 0
  const reorderLevel = Number(product.reorder_level) || 0

  return NextResponse.json({
    item: {
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      category: product.category ?? null,
      quantity,
      unit: product.unit_of_measure ?? null,
      reorderLevel,
      expiryDate: product.expiry_date ?? null,
      status: classifyProduct(quantity, reorderLevel, product.expiry_date ?? null),
      batchNumber: product.batch_number ?? null,
      shelfLocation: null,
      unitCost: product.cost_price != null ? Number(product.cost_price) : null,
      currency: 'UGX',
    },
  })
}
```

- [ ] **Step 2: Write `lab/route.ts`**

Create `apps/web/src/app/api/mobile/lab/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) {
    return NextResponse.json({ orders: [], stats: { pending: 0, inProgress: 0, collected: 0 } })
  }

  const { data: orders, error } = await db()
    .from('encounter_orders')
    .select('id, encounter_id, order_type, status, name, created_by, created_at')
    .eq('tenant_id', tenantId)
    .eq('order_type', 'lab')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load lab orders' }, { status: 500 })
  }

  const rows = (orders ?? []) as Array<{
    id: string; encounter_id: string | null; status: string; name: string | null
    created_by: string | null; created_at: string
  }>

  const encounterIds = [...new Set(rows.map((r) => r.encounter_id).filter(Boolean))] as string[]
  const orderedByIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[]

  const [encountersRes, profilesRes] = await Promise.all([
    encounterIds.length
      ? db().from('encounters').select('id, patient_id').in('id', encounterIds)
      : Promise.resolve({ data: [] }),
    orderedByIds.length
      ? db().from('profiles').select('id, full_name, first_name, last_name').in('id', orderedByIds)
      : Promise.resolve({ data: [] }),
  ])

  const encounterPatientMap = new Map(
    (encountersRes.data ?? []).map((e: { id: string; patient_id: string | null }) => [e.id, e.patient_id])
  )
  const patientIds = [...new Set(Array.from(encounterPatientMap.values()).filter(Boolean))] as string[]

  const patientsRes = patientIds.length
    ? await db().from('patients').select('id, full_name, mrn').in('id', patientIds)
    : { data: [] }

  const patientMap = new Map(
    (patientsRes.data ?? []).map((p: { id: string; full_name: string; mrn: string | null }) => [p.id, p])
  )
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p: Record<string, string | null>) => [
      p.id,
      p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || null),
    ])
  )

  const orderList = rows.map((r) => {
    const patientId = r.encounter_id ? encounterPatientMap.get(r.encounter_id) : null
    const patient = patientId ? patientMap.get(patientId) : undefined
    return {
      id: r.id,
      patientName: patient?.full_name ?? 'Unknown patient',
      patientMrn: patient?.mrn ?? null,
      testName: r.name ?? 'Lab test',
      status: r.status,
      orderedAt: r.created_at,
      orderedBy: r.created_by ? profileMap.get(r.created_by) ?? null : null,
    }
  })

  const stats = {
    pending: rows.filter((r) => r.status === 'pending').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    collected: rows.filter((r) => r.status === 'completed').length,
  }

  return NextResponse.json({ orders: orderList, stats })
}
```

- [ ] **Step 3: Write `claims/route.ts`**

Create `apps/web/src/app/api/mobile/claims/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) {
    return NextResponse.json({
      claims: [],
      summary: { total: 0, pending: 0, approved: 0, rejected: 0, totalAmount: 0 },
    })
  }

  const { data: rows, error } = await db()
    .from('insurance_claims')
    .select('id, patient_id, insurer_name, billed_amount, status, submitted_at, service_from')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }

  const claimRows = (rows ?? []) as Array<{
    id: string; patient_id: string | null; insurer_name: string | null
    billed_amount: number | null; status: string; submitted_at: string | null; service_from: string | null
  }>

  const patientIds = [...new Set(claimRows.map((r) => r.patient_id).filter(Boolean))] as string[]
  const patientsRes = patientIds.length
    ? await db().from('patients').select('id, full_name').in('id', patientIds)
    : { data: [] }
  const patientMap = new Map(
    (patientsRes.data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  )

  const claims = claimRows.map((r) => ({
    id: r.id,
    patientName: r.patient_id ? patientMap.get(r.patient_id) ?? 'Unknown patient' : 'Unknown patient',
    amount: Number(r.billed_amount) || 0,
    currency: 'UGX',
    insurer: r.insurer_name,
    status: r.status,
    submittedAt: r.submitted_at,
    serviceDate: r.service_from,
  }))

  const [totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'pending'),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'approved'),
    db().from('insurance_claims').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'rejected'),
  ])

  const totalAmount = claims.reduce((sum, c) => sum + c.amount, 0)

  return NextResponse.json({
    claims,
    summary: {
      total: totalCount.count ?? 0,
      pending: pendingCount.count ?? 0,
      approved: approvedCount.count ?? 0,
      rejected: rejectedCount.count ?? 0,
      totalAmount,
    },
  })
}
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/mobile/inventory/ apps/web/src/app/api/mobile/lab/ apps/web/src/app/api/mobile/claims/
git commit -m "feat(mobile): add inventory detail, lab orders, and claims endpoints"
```

---

### Task 6: Biometric lock screen UI

**Files:**
- Create: `apps/app/components/LockScreen.tsx`
- Modify: `apps/app/app/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth()`'s existing `isLocked: boolean` and `unlock: () => Promise<boolean>` (both already implemented in `apps/app/lib/auth.tsx`, currently unconsumed anywhere).
- Produces: nothing new consumed by other tasks.

- [ ] **Step 1: Write the lock screen component**

Create `apps/app/components/LockScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SynapseLogo } from '@/components/SynapseLogo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { colors, spacing, typography } from '@/lib/theme'

export function LockScreen() {
  const { unlock } = useAuth()
  const [attempting, setAttempting] = useState(true)
  const triedOnMount = useRef(false)

  useEffect(() => {
    if (triedOnMount.current) return
    triedOnMount.current = true
    unlock().finally(() => setAttempting(false))
  }, [unlock])

  function handlePress() {
    setAttempting(true)
    unlock().finally(() => setAttempting(false))
  }

  return (
    <View style={styles.root}>
      <SynapseLogo size="lg" />
      <Text style={styles.title}>Locked</Text>
      <Text style={styles.body}>Confirm it&apos;s you to continue.</Text>
      {attempting ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <Button label="Unlock" onPress={handlePress} style={styles.button} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    marginTop: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  spinner: { marginTop: spacing.md },
  button: { minWidth: 160, marginTop: spacing.md },
})
```

- [ ] **Step 2: Wire it into the root layout**

Read `apps/app/app/_layout.tsx` first to confirm the current structure (it renders `<AuthProvider><StatusBar/><Stack .../></AuthProvider>` per the last read in this session). `isLocked` lives on `useAuth()`, which requires being inside `AuthProvider` — so add a small inner component that consumes it and conditionally renders `LockScreen` instead of the `Stack`.

Modify `apps/app/app/_layout.tsx`: add the import and an inner `RootNavigator` component, then use it in place of the raw `<Stack .../>`:

```tsx
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { LockScreen } from '@/components/LockScreen'
import { AuthProvider, useAuth } from '@/lib/auth'
import { colors } from '@/lib/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

function RootNavigator() {
  const { isLocked } = useAuth()

  if (isLocked) return <LockScreen />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  )
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  })
  const [splashReleased, setSplashReleased] = useState(false)

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
      setSplashReleased(true)
    }
  }, [fontsLoaded, fontError])

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
      setSplashReleased(true)
    }, 6_000)
    return () => clearTimeout(timer)
  }, [])

  if (!splashReleased && !fontsLoaded && !fontError) return null

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
```

Note: `apps/app/lib/auth.tsx` exports `useAuth` already (confirmed — `export function useAuth(): AuthContextValue`); no change needed there.

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/app`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/app/components/LockScreen.tsx apps/app/app/_layout.tsx
git commit -m "feat(mobile): add lock screen UI for existing biometric re-auth state"
```

---

## Post-plan verification (manual, no test suite exists)

After all six tasks: run `npm run type-check --workspace=apps/app` and `npm run type-check --workspace=apps/web` one more time from a clean state to confirm nothing regressed across tasks. If a Supabase local/dev environment is reachable, apply the new migration (`supabase db push` or equivalent) and spot-check one request per new route with a real token before considering this plan fully verified — the `/verify` skill or manually running `expo start` + logging in as each role is the closest thing this repo has to an integration test for this surface.
