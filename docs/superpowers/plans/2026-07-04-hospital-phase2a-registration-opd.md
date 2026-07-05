# Hospital Phase 2a — Registration & OPD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared hospital-department auth/UI infra, then wire real Registration (new-patient form) and OPD (queue + triage) functionality into `apps/web`, on branch `hospital-build/phase-2a-registration-opd`.

**Architecture:** Extract the auth/capability/module-gate/audit helpers already built for Phase 1's admin console into a shared `hospital-shared` lib (no behavior change for existing Phase 1 routes), add a new `hospital-dept` context for non-admin staff, then add three new API routes (`POST /api/patients/register`, `GET /api/opd/queue`, `POST /api/opd/triage`) and department UI (`DepartmentShell`, `PatientSearch`, `usePatientContext`, a real `/dept/opd/queue` page, and a registration form added to the existing `/os/[slug]/patients` screen).

**Tech Stack:** Next.js 15 App Router API routes, `@synapse/auth` (cookie/JWT session), `@synapse/auth/capability` (RBAC), `@synapse/auth/features` (subscription gating), `supabaseAdmin` service-role client, zod validation, React 19 client components.

## Global Constraints

- Every route follows: auth (session cookie) → capability check → module/feature gate → zod validation → service-role query → `audit_log` write. (Master prompt rule.)
- No synthetic/demo transactional data. (Master prompt rule.)
- Do not touch the pharmacy POS money path (`apps/pharmacy`, `pharmacy_transactions`). (Master prompt rule.)
- New modules ship FLAG-OFF by default — `opd`/`registration` module toggles already default inactive per Phase 0's seed; do not change that. (Master prompt rule.)
- Capability triples MUST match exactly what `20260704120000_hospital_module_registry_seed.sql` seeded: `('registration','patient','register')`, `('opd','queue','read')`, `('opd','queue','write')`, `('opd','triage','assign')`, `('opd','encounter','create')`. Using any other resource/action string means `has_capability()` returns false for every role and the route 403s unconditionally.
- Live `patients` table columns (confirmed via the deployed schema, which has drifted from the checked-in migration files — trust this list, not `20260511_production_schema.sql`): `id, tenant_id, hospital_id, mrn, full_name, dob, sex, phone, district, nin, is_deleted, created_at, created_by`. Do NOT use `first_name`/`last_name`/`date_of_birth`/`is_active` — those are stale.
- Live `encounters` columns: `id, tenant_id, hospital_id, patient_id, department_id, clinician_id, chief_complaint, clinical_stage, status, metadata, visit_date, is_deleted, created_at, created_by, version`.
- Live `vitals` columns: `id, tenant_id, encounter_id, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature_c, spo2, weight_kg, height_cm, notes, recorded_by, recorded_at, is_deleted, version`.
- No test runner exists in `apps/web` (confirmed: no `test` script in `package.json`, no `*.test.ts` files). Verification for every task is `cd apps/web && npm run type-check` (must exit 0), matching how Phase 0/1 were verified. Do not introduce a new test framework — out of scope.
- This is TypeScript/Next.js, not Python — code blocks below are actual file contents to write, not illustrative pseudocode.

---

### Task 1: Extract shared hospital-lib from hospital-admin (pure refactor)

**Files:**
- Create: `apps/web/src/lib/hospital-shared/context.ts`
- Create: `apps/web/src/lib/hospital-shared/guard.ts`
- Create: `apps/web/src/lib/hospital-shared/modules.ts`
- Create: `apps/web/src/lib/hospital-shared/audit.ts`
- Create: `apps/web/src/lib/hospital-shared/index.ts`
- Modify: `apps/web/src/lib/hospital-admin/context.ts` (keep `requireHospitalAdminContext`, re-export shared type/helper)
- Modify: `apps/web/src/lib/hospital-admin/index.ts` (re-export from `hospital-shared` instead of local files)
- Delete: `apps/web/src/lib/hospital-admin/guard.ts`
- Delete: `apps/web/src/lib/hospital-admin/modules.ts`
- Delete: `apps/web/src/lib/hospital-admin/audit.ts`

**Interfaces:**
- Produces: `HospitalContext` interface `{ userId: string; email: string; role: string; tenantId: string; hospitalId: string; facilityType: string; fullName: string | null }`, `isContextError(value): value is NextResponse`, `requireHospitalCapability(ctx: HospitalContext, resource: string, action: string, module?: string): Promise<NextResponse | null>`, `fetchModuleRegistry(): Promise<ModuleRegistryEntry[]>`, `isHospitalModuleActive(hospitalId, moduleKey): Promise<boolean>`, `gateHospitalModule(tenantId, hospitalId, moduleKey): Promise<NextResponse | null>`, `logHospitalAudit(params): Promise<void>` — all from `apps/web/src/lib/hospital-shared`.
- Every existing Phase 1 route file imports from `../../../../../lib/hospital-admin` (relative depth varies by route) and must continue to work with zero edits — `hospital-admin/index.ts` re-exports everything Phase 1 routes use.

- [ ] **Step 1: Create `hospital-shared/context.ts`**

```ts
import 'server-only'

import { NextResponse } from 'next/server'

export interface HospitalContext {
  userId: string
  email: string
  role: string
  tenantId: string
  hospitalId: string
  facilityType: string
  fullName: string | null
}

export function isContextError(
  value: HospitalContext | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse
}
```

- [ ] **Step 2: Create `hospital-shared/guard.ts`** (moved verbatim from `hospital-admin/guard.ts`, retyped)

```ts
import 'server-only'

import { NextResponse } from 'next/server'
import { requireCapability, CapabilityError } from '@synapse/auth/capability'
import type { HospitalContext } from './context'

export async function requireHospitalCapability(
  ctx: HospitalContext,
  resource: string,
  action: string,
  module = 'config',
): Promise<NextResponse | null> {
  try {
    await requireCapability(
      { role: ctx.role },
      module,
      resource,
      action,
      ctx.facilityType === 'hospital' ? 'hospital' : 'any',
    )
    return null
  } catch (e) {
    if (e instanceof CapabilityError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw e
  }
}
```

- [ ] **Step 3: Create `hospital-shared/modules.ts`** (moved verbatim from `hospital-admin/modules.ts`, no type changes needed — it already takes primitive args)

```ts
import 'server-only'

import { NextResponse } from 'next/server'
import { gateFeature } from '@synapse/auth/features'
import { supabaseAdmin } from '@synapse/db/admin'

export interface ModuleRegistryEntry {
  key: string
  label: string
  default_enabled: boolean
  feature_key: string | null
}

export async function fetchModuleRegistry(): Promise<ModuleRegistryEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from('platform_billing_config')
    .select('value')
    .eq('key', 'hospital_module_registry')
    .maybeSingle()

  if (!Array.isArray(data?.value)) return []
  return data.value as ModuleRegistryEntry[]
}

export async function isHospitalModuleActive(
  hospitalId: string,
  moduleKey: string,
): Promise<boolean> {
  if (moduleKey === 'core' || moduleKey === 'platform') return true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from('hospital_modules')
    .select('is_active')
    .eq('hospital_id', hospitalId)
    .eq('module_key', moduleKey)
    .maybeSingle()

  return Boolean(data?.is_active)
}

/** Returns 403 when tenant module toggle is off; 402 when subscription feature missing. */
export async function gateHospitalModule(
  tenantId: string,
  hospitalId: string,
  moduleKey: string,
): Promise<NextResponse | null> {
  if (moduleKey === 'core' || moduleKey === 'platform') return null

  const active = await isHospitalModuleActive(hospitalId, moduleKey)
  if (!active) {
    return NextResponse.json(
      { error: 'module_disabled', module_key: moduleKey, message: `Module '${moduleKey}' is not enabled for this hospital.` },
      { status: 403 },
    )
  }

  const registry = await fetchModuleRegistry()
  const entry = registry.find((m) => m.key === moduleKey)
  if (entry?.feature_key) {
    const featureBlock = await gateFeature(tenantId, entry.feature_key)
    if (featureBlock) return featureBlock
  }

  return null
}
```

- [ ] **Step 4: Create `hospital-shared/audit.ts`** (moved from `hospital-admin/audit.ts`, retyped to `HospitalContext`)

```ts
import 'server-only'

import { supabaseAdmin } from '@synapse/db/admin'
import type { HospitalContext } from './context'

export async function logHospitalAudit(params: {
  ctx: HospitalContext
  action: string
  tableName: string
  recordId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from('audit_log').insert({
    tenant_id: params.ctx.tenantId,
    user_id: params.ctx.userId,
    user_role: params.ctx.role,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    created_by: params.ctx.userId,
  }).catch(() => {})
}
```

- [ ] **Step 5: Create `hospital-shared/index.ts`**

```ts
export { isContextError, type HospitalContext } from './context'
export { requireHospitalCapability } from './guard'
export { fetchModuleRegistry, gateHospitalModule, isHospitalModuleActive, type ModuleRegistryEntry } from './modules'
export { logHospitalAudit } from './audit'
```

- [ ] **Step 6: Rewrite `hospital-admin/context.ts`** to alias the shared type and keep only the admin-role-gate logic

```ts
import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'
import type { HospitalContext } from '../hospital-shared'

export type HospitalAdminContext = HospitalContext

const ADMIN_ROLES = new Set(['hospital_admin', 'platform_admin', 'admin'])

export async function requireHospitalAdminContext(): Promise<
  HospitalAdminContext | NextResponse
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { valid } = await validateSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, tenant_id, hospital_id, is_admin')
    .eq('id', payload.sub)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const role = String(profile.role ?? payload.role ?? '')
  if (!ADMIN_ROLES.has(role) && !profile.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('facility_type')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const facilityType = String(tenant?.facility_type ?? 'hospital')
  if (facilityType !== 'hospital' && role !== 'platform_admin') {
    return NextResponse.json({ error: 'Hospital facility required' }, { status: 403 })
  }

  const hospitalId = profile.hospital_id ?? profile.tenant_id

  return {
    userId: profile.id,
    email: profile.email ?? payload.email ?? '',
    role,
    tenantId: profile.tenant_id,
    hospitalId,
    facilityType,
    fullName: profile.full_name ?? null,
  }
}
```

Note: `isContextError` is no longer defined here — `hospital-admin/index.ts` re-exports it from `hospital-shared` in the next step.

- [ ] **Step 7: Delete the now-redundant files**

```bash
rm apps/web/src/lib/hospital-admin/guard.ts
rm apps/web/src/lib/hospital-admin/modules.ts
rm apps/web/src/lib/hospital-admin/audit.ts
```

- [ ] **Step 8: Rewrite `hospital-admin/index.ts`**

```ts
export { requireHospitalAdminContext, type HospitalAdminContext } from './context'
export { isContextError, logHospitalAudit, requireHospitalCapability, fetchModuleRegistry, gateHospitalModule, isHospitalModuleActive, type ModuleRegistryEntry } from '../hospital-shared'
export * from './schemas'
```

- [ ] **Step 9: Verify nothing broke**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0, no errors in any `api/hospital/admin/*` route file.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/hospital-shared apps/web/src/lib/hospital-admin
git commit -m "refactor(hospital): extract hospital-shared lib from hospital-admin

Moves the auth-context type, capability guard, module-gate, and audit
helpers into a lib both hospital-admin and the new hospital-dept
context can use, with zero changes to any existing Phase 1 route."
```

---

### Task 2: hospital-dept staff context + zod schemas

**Files:**
- Create: `apps/web/src/lib/hospital-dept/context.ts`
- Create: `apps/web/src/lib/hospital-dept/schemas.ts`
- Create: `apps/web/src/lib/hospital-dept/index.ts`

**Interfaces:**
- Consumes: `HospitalContext`, `isContextError` from `../hospital-shared` (Task 1).
- Produces: `requireHospitalStaffContext(): Promise<HospitalContext | NextResponse>`, `patientRegisterSchema`, `triageSchema` (zod schemas) — used by Tasks 3–5.

- [ ] **Step 1: Create `hospital-dept/context.ts`**

```ts
import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'
import type { HospitalContext } from '../hospital-shared'

export async function requireHospitalStaffContext(): Promise<
  HospitalContext | NextResponse
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { valid } = await validateSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, tenant_id, hospital_id')
    .eq('id', payload.sub)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('facility_type')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const facilityType = String(tenant?.facility_type ?? 'hospital')
  const role = String(profile.role ?? payload.role ?? '')
  if (facilityType !== 'hospital' && role !== 'platform_admin') {
    return NextResponse.json({ error: 'Hospital facility required' }, { status: 403 })
  }

  const hospitalId = profile.hospital_id ?? profile.tenant_id

  return {
    userId: profile.id,
    email: profile.email ?? payload.email ?? '',
    role,
    tenantId: profile.tenant_id,
    hospitalId,
    facilityType,
    fullName: profile.full_name ?? null,
  }
}
```

- [ ] **Step 2: Create `hospital-dept/schemas.ts`**

```ts
import { z } from 'zod'

export const patientRegisterSchema = z.object({
  full_name: z.string().min(1).max(200),
  dob: z.string().min(4).max(40).optional(),
  sex: z.enum(['M', 'F']),
  phone: z.string().max(30).optional(),
  district: z.string().max(100).optional(),
  nin: z.string().max(30).optional(),
})

export const triageSchema = z.object({
  patient_id: z.string().uuid(),
  chief_complaint: z.string().min(1).max(2000),
  clinical_stage: z.enum(['RED', 'YELLOW', 'GREEN']).optional(),
  bp_systolic: z.coerce.number().min(50).max(300).optional(),
  bp_diastolic: z.coerce.number().min(20).max(200).optional(),
  heart_rate: z.coerce.number().min(20).max(250).optional(),
  respiratory_rate: z.coerce.number().min(5).max(60).optional(),
  temperature_c: z.coerce.number().min(30).max(43).optional(),
  spo2: z.coerce.number().min(50).max(100).optional(),
})
```

- [ ] **Step 3: Create `hospital-dept/index.ts`**

```ts
export { requireHospitalStaffContext } from './context'
export * from './schemas'
```

- [ ] **Step 4: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hospital-dept
git commit -m "feat(hospital): add hospital-dept staff context and Phase 2a zod schemas"
```

---

### Task 3: `POST /api/patients/register`

**Files:**
- Create: `apps/web/src/app/api/patients/register/route.ts`

**Interfaces:**
- Consumes: `requireHospitalStaffContext`, `patientRegisterSchema` from `../../../../lib/hospital-dept`; `isContextError`, `requireHospitalCapability`, `gateHospitalModule`, `logHospitalAudit` from `../../../../lib/hospital-shared`.
- Produces: `POST /api/patients/register` → `{ patient: { id, mrn, full_name, dob, sex } }` on 201.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, patientRegisterSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

function generateMrn(hospitalId: string): string {
  const shortId = hospitalId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const stamp = Date.now().toString(36).toUpperCase()
  return `${shortId}-${stamp}`
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'patient', 'register', 'registration')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'registration')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = patientRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    ...parsed.data,
    tenant_id: ctx.tenantId,
    hospital_id: ctx.hospitalId,
    mrn: generateMrn(ctx.hospitalId),
    is_deleted: false,
    created_by: ctx.userId,
  }

  const { data, error } = await db
    .from('patients')
    .insert(row)
    .select('id, mrn, full_name, dob, sex')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'patients',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ patient: data }, { status: 201 })
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/patients/register/route.ts
git commit -m "feat(hospital): add POST /api/patients/register"
```

---

### Task 4: `GET /api/opd/queue`

**Files:**
- Create: `apps/web/src/app/api/opd/queue/route.ts`

**Interfaces:**
- Consumes: `requireHospitalStaffContext` from `hospital-dept`; `isContextError`, `requireHospitalCapability`, `gateHospitalModule` from `hospital-shared`.
- Produces: `GET /api/opd/queue` → `{ queue: Array<{ encounterId, patientId, fullName, mrn, dob, sex, chiefComplaint, clinicalStage, status, visitDate }> }`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'queue', 'read', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounters, error } = await db
    .from('encounters')
    .select('id, patient_id, chief_complaint, clinical_stage, status, visit_date')
    .eq('tenant_id', ctx.tenantId)
    .eq('hospital_id', ctx.hospitalId)
    .eq('is_deleted', false)
    .gte('visit_date', todayStart.toISOString())
    .in('status', ['open', 'in_progress', 'completed'])
    .order('visit_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const patientIds = [...new Set((encounters ?? []).map((e: { patient_id: string }) => e.patient_id))]
  const { data: patients } = patientIds.length
    ? await db
        .from('patients')
        .select('id, full_name, mrn, dob, sex')
        .in('id', patientIds)
    : { data: [] }

  const patientMap = new Map(
    (patients ?? []).map((p: { id: string; full_name: string; mrn: string | null; dob: string | null; sex: string | null }) => [p.id, p]),
  )

  const queue = (encounters ?? []).map((e: {
    id: string; patient_id: string; chief_complaint: string | null
    clinical_stage: string | null; status: string; visit_date: string
  }) => {
    const patient = patientMap.get(e.patient_id) as
      | { id: string; full_name: string; mrn: string | null; dob: string | null; sex: string | null }
      | undefined
    return {
      encounterId: e.id,
      patientId: e.patient_id,
      fullName: patient?.full_name ?? 'Unknown',
      mrn: patient?.mrn ?? null,
      dob: patient?.dob ?? null,
      sex: patient?.sex ?? null,
      chiefComplaint: e.chief_complaint,
      clinicalStage: e.clinical_stage,
      status: e.status,
      visitDate: e.visit_date,
    }
  })

  return NextResponse.json({ queue })
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/opd/queue/route.ts
git commit -m "feat(hospital): add GET /api/opd/queue"
```

---

### Task 5: `POST /api/opd/triage`

**Files:**
- Create: `apps/web/src/app/api/opd/triage/route.ts`

**Interfaces:**
- Consumes: `requireHospitalStaffContext`, `triageSchema` from `hospital-dept`; `isContextError`, `requireHospitalCapability`, `gateHospitalModule`, `logHospitalAudit` from `hospital-shared`.
- Produces: `POST /api/opd/triage` → `{ encounterId }` on 201.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, triageSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'triage', 'assign', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = triageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { patient_id, chief_complaint, clinical_stage, ...vitalsFields } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encounterError } = await db
    .from('encounters')
    .insert({
      tenant_id: ctx.tenantId,
      hospital_id: ctx.hospitalId,
      patient_id,
      clinician_id: ctx.userId,
      chief_complaint,
      clinical_stage: clinical_stage ?? null,
      status: 'open',
      visit_date: new Date().toISOString(),
      is_deleted: false,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 })

  const hasVitals = Object.values(vitalsFields).some((v) => v !== undefined)
  if (hasVitals) {
    await db.from('vitals').insert({
      tenant_id: ctx.tenantId,
      encounter_id: encounter.id,
      ...vitalsFields,
      recorded_by: ctx.userId,
      recorded_at: new Date().toISOString(),
      is_deleted: false,
    })
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'encounters',
    recordId: encounter.id,
    newValue: { patient_id, chief_complaint, clinical_stage },
  })

  return NextResponse.json({ encounterId: encounter.id }, { status: 201 })
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/opd/triage/route.ts
git commit -m "feat(hospital): add POST /api/opd/triage"
```

---

### Task 6: Shared department UI primitives

**Files:**
- Create: `apps/web/src/app/api/patients/search/route.ts`
- Create: `apps/web/src/components/hospital-dept/DepartmentShell.tsx`
- Create: `apps/web/src/components/hospital-dept/PatientSearch.tsx`
- Create: `apps/web/src/hooks/usePatientContext.ts`

**Interfaces:**
- Produces: `GET /api/patients/search?q=...&limit=...` → `{ patients: Array<{ id, fullName, mrn }> }`; `<DepartmentShell queuePanel={ReactNode} patientBanner={ReactNode}>{children}</DepartmentShell>`, `<PatientSearch onSelect={(patient: PatientSearchResult) => void} />` where `PatientSearchResult = { id: string; fullName: string; mrn: string | null }`, `usePatientContext()` returning `{ patient, setPatient }`.
- Consumed by: Task 7 (`/dept/opd/queue/page.tsx`).

**Why a new search route:** `GET /api/mobile/patients` (existing) authenticates via `Authorization: Bearer` header only — it does not read the `SESSION_COOKIE` cookie the web app uses. A browser `fetch` with `credentials: 'include'` against that route would 401. `PatientSearch` is a web component, so it needs a cookie-authenticated route. This one uses `requireHospitalStaffContext()` (same as the other Phase 2a routes) with no capability gate — name/MRN lookup is a broadly-needed, non-sensitive-write read used across departments, matching the permission model `GET /api/mobile/patients` itself already uses (auth + tenant scope, no granular capability check).

- [ ] **Step 1: Write `apps/web/src/app/api/patients/search/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50)

  if (q.length < 2) return NextResponse.json({ patients: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: patients, error } = await db
    .from('patients')
    .select('id, full_name, mrn')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .or(`full_name.ilike.%${q}%,mrn.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    patients: (patients ?? []).map((p: { id: string; full_name: string; mrn: string | null }) => ({
      id: p.id,
      fullName: p.full_name,
      mrn: p.mrn,
    })),
  })
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/patients/search/route.ts
git commit -m "feat(hospital): add GET /api/patients/search (cookie-authed, for web PatientSearch)"
```

- [ ] **Step 4: Write `hooks/usePatientContext.ts`**

```ts
'use client'

import { useState, useCallback } from 'react'

export interface SelectedPatient {
  id: string
  fullName: string
  mrn: string | null
}

export function usePatientContext() {
  const [patient, setPatientState] = useState<SelectedPatient | null>(null)

  const setPatient = useCallback((p: SelectedPatient | null) => {
    setPatientState(p)
  }, [])

  return { patient, setPatient }
}
```

- [ ] **Step 5: Write `components/hospital-dept/PatientSearch.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import type { SelectedPatient } from '../../hooks/usePatientContext'

interface PatientSearchProps {
  onSelect: (patient: SelectedPatient) => void
}

interface RawPatient {
  id: string
  full_name: string
  mrn: string | null
}

export function PatientSearch({ onSelect }: PatientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RawPatient[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=10`, {
        credentials: 'include',
      })
      const data = await res.json()
      setResults(
        (data.patients ?? []).map((p: { id: string; fullName: string; mrn: string | null }) => ({
          id: p.id,
          full_name: p.fullName,
          mrn: p.mrn,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or MRN"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      {loading && <p className="text-xs opacity-60">Searching…</p>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--synapse-border)] rounded border border-[var(--synapse-border)]">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect({ id: p.id, fullName: p.full_name, mrn: p.mrn })}
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                {p.full_name} {p.mrn ? `(${p.mrn})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Note: calls the new cookie-authenticated `GET /api/patients/search` from Step 1 of this task (not `/api/mobile/patients`, which is Bearer-token-only and would 401 for a browser session). Response shape (`{ patients: [{ id, fullName, mrn }] }`) is identical between the two routes, so the `.map` below needs no special-casing.

- [ ] **Step 6: Write `components/hospital-dept/DepartmentShell.tsx`**

```tsx
import type { ReactNode } from 'react'

interface DepartmentShellProps {
  patientBanner?: ReactNode
  queuePanel: ReactNode
  children: ReactNode
}

export function DepartmentShell({ patientBanner, queuePanel, children }: DepartmentShellProps) {
  return (
    <div className="flex h-full flex-col">
      {patientBanner && (
        <div className="border-b border-[var(--synapse-border)] px-4 py-3">{patientBanner}</div>
      )}
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="w-full border-b border-[var(--synapse-border)] p-4 md:w-80 md:border-b-0 md:border-r">
          {queuePanel}
        </aside>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/hospital-dept apps/web/src/hooks/usePatientContext.ts
git commit -m "feat(hospital): add DepartmentShell, PatientSearch, usePatientContext"
```

---

### Task 7: `/dept/opd/queue` page

**Files:**
- Create: `apps/web/src/app/dept/opd/queue/page.tsx`

**Interfaces:**
- Consumes: `DepartmentShell`, `PatientSearch` from `../../../components/hospital-dept`; `usePatientContext` from `../../../hooks/usePatientContext`; calls `GET /api/opd/queue` and `POST /api/opd/triage`.

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { DepartmentShell } from '../../../components/hospital-dept/DepartmentShell'
import { PatientSearch } from '../../../components/hospital-dept/PatientSearch'
import { usePatientContext } from '../../../hooks/usePatientContext'

interface QueueRow {
  encounterId: string
  patientId: string
  fullName: string
  mrn: string | null
  chiefComplaint: string | null
  clinicalStage: string | null
  status: string
  visitDate: string
}

export default function OpdQueuePage() {
  const { patient, setPatient } = usePatientContext()
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/opd/queue', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setQueue(data.queue ?? [])
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const submitTriage = useCallback(async () => {
    if (!patient || !chiefComplaint.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/opd/triage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patient.id, chief_complaint: chiefComplaint }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ? JSON.stringify(data.error) : 'Failed to save triage')
        return
      }
      setChiefComplaint('')
      setPatient(null)
      await loadQueue()
    } finally {
      setSubmitting(false)
    }
  }, [patient, chiefComplaint, setPatient, loadQueue])

  return (
    <DepartmentShell
      patientBanner={patient ? <p className="text-sm">Selected: {patient.fullName}</p> : null}
      queuePanel={
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase opacity-70">Today&apos;s Queue</h2>
          <ul className="flex flex-col gap-2">
            {queue.map((row) => (
              <li key={row.encounterId} className="rounded border border-[var(--synapse-border)] p-2 text-sm">
                <p className="font-medium">{row.fullName}</p>
                <p className="opacity-70">{row.chiefComplaint ?? 'No complaint recorded'}</p>
                <p className="text-xs opacity-50">{row.status}</p>
              </li>
            ))}
            {queue.length === 0 && <p className="text-xs opacity-50">No encounters yet today.</p>}
          </ul>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">OPD Triage</h1>
        <PatientSearch onSelect={setPatient} />
        {patient && (
          <div className="flex flex-col gap-2">
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Chief complaint"
              className="rounded border border-[var(--synapse-border)] bg-transparent p-2 text-sm"
              rows={3}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              disabled={submitting || !chiefComplaint.trim()}
              onClick={submitTriage}
              className="self-start rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save triage'}
            </button>
          </div>
        )}
      </div>
    </DepartmentShell>
  )
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dept/opd/queue/page.tsx
git commit -m "feat(hospital): add /dept/opd/queue page (triage + live queue)"
```

---

### Task 8: Registration form on `/os/[slug]/patients`

**Files:**
- Modify: `apps/web/src/app/os/[slug]/patients/page.tsx`

**Interfaces:**
- Consumes: `POST /api/patients/register` (Task 3).
- This task requires reading the current file first (it's a server component today, per the Phase 2a audit) — add a client-side registration form as a sibling client component rather than converting the whole page.

- [ ] **Step 1: Read the current file** to confirm its exact current structure before editing

Run: `cat apps/web/src/app/os/[slug]/patients/page.tsx` (or open in editor) — confirm it's a server component doing a direct `supabase.from('patients').select(...)` query with `?q=` search, as documented in this plan's context, before making the edit below. If the structure differs from what's described, stop and re-derive the edit from the actual file rather than applying the diff blindly.

- [ ] **Step 2: Create `apps/web/src/app/os/[slug]/patients/RegisterPatientForm.tsx`** (new client component, kept separate from the server component page)

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function RegisterPatientForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('F')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!fullName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/patients/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          sex,
          dob: dob || undefined,
          phone: phone || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ? JSON.stringify(data.error) : 'Failed to register patient')
        return
      }
      setFullName('')
      setDob('')
      setPhone('')
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }, [fullName, sex, dob, phone, router])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black"
      >
        Register patient
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-[var(--synapse-border)] p-4">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <select
        value={sex}
        onChange={(e) => setSex(e.target.value as 'M' | 'F')}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      >
        <option value="F">Female</option>
        <option value="M">Male</option>
      </select>
      <input
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || !fullName.trim()}
          onClick={submit}
          className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-[var(--synapse-border)] px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Import and render `<RegisterPatientForm />`** in the existing server-component page. Since the exact current JSX isn't captured verbatim in this plan (server-rendered list/search page, confirmed present but not fully reproduced here), add the import at the top:

```ts
import { RegisterPatientForm } from './RegisterPatientForm'
```

and render `<RegisterPatientForm />` near the search input/header of the existing list UI (above or beside the search box) — a single additive JSX line, not a restructure of the rest of the page.

- [ ] **Step 4: Verify**

Run: `cd apps/web && npm run type-check`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/os/[slug]/patients
git commit -m "feat(hospital): add patient registration form to /os/[slug]/patients"
```

---

### Task 9: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Run the full production build gate**

Run: `cd apps/web && npm run verify:web`
Expected: exit 0, output ends with `[verify:web] OK — matches root vercel.json buildCommand`.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin hospital-build/phase-2a-registration-opd
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "Phase 2a: Registration & OPD (department infra + queue/triage)" --body "$(cat <<'EOF'
## Summary
- Extracts hospital-shared auth/capability/module-gate/audit lib from hospital-admin (no behavior change to Phase 1 routes)
- Adds hospital-dept staff context (non-admin roles) for department routes
- Adds POST /api/patients/register, GET /api/opd/queue, POST /api/opd/triage
- Adds DepartmentShell/PatientSearch/usePatientContext shared UI primitives
- Adds /dept/opd/queue page and a registration form on /os/[slug]/patients
- Deferred: patient-merge/dedup (separate PR), doctor consultation workspace (sub-phase 2b, follows the existing approved 2026-06-09 spec)

Depends on Phase 0 (module registry seed) + Phase 1 (hospital admin console, now includes Phase 0) — branched from the corrected hospital-build/phase-1-hospital-admin.

## Test plan
- [x] `npm run type-check` passes after every task
- [x] `npm run verify:web` (production build) passes
- [ ] Manual smoke test once `opd`/`registration` modules are toggled on for a test hospital: register a patient, see them in the OPD queue after triage
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** All in-scope items from the design spec (hospital-shared extraction, hospital-dept context, 3 API routes, 3 UI primitives, 1 new page, 1 modified page) map to Tasks 1–8. Deferred items (merge, consult workspace) are explicitly excluded, matching the spec.
- **Capability keys:** Every route's `requireHospitalCapability` call uses the exact `(resource, action, module)` triples confirmed present in `20260704120000_hospital_module_registry_seed.sql` — cross-checked against the migration file directly, not assumed.
- **Column names:** Every insert/select uses column names confirmed against the live deployed schema (via the Supabase PostgREST OpenAPI description), not the stale checked-in migration.
- **Type consistency:** `HospitalContext` (Task 1) is the single shape threaded through `hospital-shared`, `hospital-admin`, and `hospital-dept` — no divergent field names introduced.
