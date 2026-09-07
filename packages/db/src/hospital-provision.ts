import { RESERVED_FACILITY_SLUGS, provisioningCanActivate } from "./hospital-provision-catalog"
/**
 * Durable hospital facility provisioning (Platform Admin onboarding).
 * Explicit step status — never silently ignore failures.
 * Modes: REAL | SYNTHETIC_ACCEPTANCE
 */

import {
  HOSPITAL_CANONICAL_NAME,
  HOSPITAL_CANONICAL_SLUG,
  HOSPITAL_DEPARTMENTS,
  HOSPITAL_LOCATIONS,
  HOSPITAL_STAFF_ROLES,
} from "./hospital-seed"
import {
  CANONICAL_HOSPITAL_MODULES,
  FACILITY_LEVELS,
  FACILITY_OWNERSHIP,
  defaultModulesForLevel,
  normalizeModuleKeys,
  slugify,
  type FacilityLevel,
  type FacilityOwnership,
} from "./hospital-provision-catalog"

export {
  CANONICAL_HOSPITAL_MODULES,
  FACILITY_LEVELS,
  FACILITY_OWNERSHIP,
  LEGACY_MODULE_KEY_MAP,
  defaultModulesForLevel,
  normalizeModuleKeys,
  slugify,
  type FacilityLevel,
  type FacilityOwnership,
} from "./hospital-provision-catalog"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any

export const PROVISION_MODES = ["REAL", "SYNTHETIC_ACCEPTANCE"] as const
export type ProvisionMode = (typeof PROVISION_MODES)[number]

export const PROVISION_STEP_KEYS = [
  "validate",
  "core_tenant",
  "facility_profile",
  "modules",
  "departments",
  "locations",
  "subscription",
  "administrator",
  "invitation",
  "domain",
  "synthetic_staff",
  "synthetic_guards",
  "finalize",
] as const
export type ProvisionStepKey = (typeof PROVISION_STEP_KEYS)[number]

export type ProvisionStepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETE"
  | "FAILED"
  | "SKIPPED"
  | "ROLLED_BACK"

export type ProvisionRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETE"
  | "FAILED"
  | "READY_WITH_WARNINGS"
  | "ROLLED_BACK"

export type ProvisionHospitalInput = {
  facilityName: string
  slug?: string
  country?: string
  district?: string
  city?: string
  ownership: FacilityOwnership
  facilityLevel: FacilityLevel
  bedCapacity?: number
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  adminName: string
  adminEmail: string
  adminPhone?: string
  tier?: "trial" | "starter" | "professional" | "enterprise"
  modules?: string[]
  facilityType?: string
  mode?: ProvisionMode
  idempotencyKey?: string
  createdBy: string
  /** When true, process invitation email (external, retryable). */
  sendInvite?: boolean
}

export type ProvisionStepResult = {
  step: ProvisionStepKey
  status: ProvisionStepStatus
  errorCode?: string | null
  safeErrorMessage?: string | null
  evidence?: Record<string, unknown>
}

export type ProvisionHospitalResult = {
  ok: boolean
  runId: string
  tenantId: string | null
  hospitalId: string | null
  slug: string
  status: ProvisionRunStatus
  correlationId: string
  steps: ProvisionStepResult[]
  inviteToken?: string | null
  inviteStatus?: string | null
  warnings: string[]
  error?: string
}

const PLAN_SLUG_MAP: Record<string, string> = {
  trial: "hospital_starter",
  starter: "hospital_starter",
  professional: "hospital_professional",
  enterprise: "hospital_enterprise",
}

function nowIso() {
  return new Date().toISOString()
}

function hospitalsTypeFromLevel(level: FacilityLevel): string {
  switch (level) {
    case "NATIONAL_REFERRAL_HOSPITAL":
      return "national"
    case "REGIONAL_REFERRAL_HOSPITAL":
      return "referral"
    case "TEACHING_HOSPITAL":
      return "teaching"
    default:
      return "general"
  }
}

async function upsertStep(
  db: DbClient,
  runId: string,
  step: ProvisionStepKey,
  patch: Partial<{
    status: ProvisionStepStatus
    error_code: string | null
    safe_error_message: string | null
    evidence: Record<string, unknown>
    started_at: string | null
    completed_at: string | null
    attempt_count: number
  }>,
) {
  const stamp = nowIso()
  const { data: existing } = await db
    .from("facility_provisioning_steps")
    .select("id, attempt_count")
    .eq("run_id", runId)
    .eq("step", step)
    .maybeSingle()

  if (existing) {
    await db
      .from("facility_provisioning_steps")
      .update({
        ...patch,
        attempt_count: patch.attempt_count ?? Number(existing.attempt_count ?? 0) + (patch.status === "RUNNING" ? 1 : 0),
        updated_at: stamp,
      })
      .eq("id", existing.id)
    return
  }

  await db.from("facility_provisioning_steps").insert({
    run_id: runId,
    step,
    status: patch.status ?? "PENDING",
    error_code: patch.error_code ?? null,
    safe_error_message: patch.safe_error_message ?? null,
    evidence: patch.evidence ?? {},
    started_at: patch.started_at ?? null,
    completed_at: patch.completed_at ?? null,
    attempt_count: patch.attempt_count ?? (patch.status === "RUNNING" ? 1 : 0),
    created_at: stamp,
    updated_at: stamp,
  })
}

async function beginStep(db: DbClient, runId: string, step: ProvisionStepKey) {
  await db
    .from("facility_provisioning_runs")
    .update({ current_step: step, status: "RUNNING", updated_at: nowIso() })
    .eq("id", runId)
  await upsertStep(db, runId, step, { status: "RUNNING", started_at: nowIso(), error_code: null, safe_error_message: null })
}

async function completeStep(
  db: DbClient,
  runId: string,
  step: ProvisionStepKey,
  evidence: Record<string, unknown> = {},
) {
  await upsertStep(db, runId, step, {
    status: "COMPLETE",
    completed_at: nowIso(),
    evidence,
    error_code: null,
    safe_error_message: null,
  })
}

async function failStep(
  db: DbClient,
  runId: string,
  step: ProvisionStepKey,
  errorCode: string,
  message: string,
) {
  await upsertStep(db, runId, step, {
    status: "FAILED",
    completed_at: nowIso(),
    error_code: errorCode,
    safe_error_message: message,
  })
}

async function skipStep(db: DbClient, runId: string, step: ProvisionStepKey, reason: string) {
  await upsertStep(db, runId, step, {
    status: "SKIPPED",
    completed_at: nowIso(),
    evidence: { reason },
  })
}

async function getStepStatus(
  db: DbClient,
  runId: string,
  step: ProvisionStepKey,
): Promise<ProvisionStepStatus | null> {
  const { data } = await db
    .from("facility_provisioning_steps")
    .select("status")
    .eq("run_id", runId)
    .eq("step", step)
    .maybeSingle()
  return (data?.status as ProvisionStepStatus) ?? null
}

/** Skip re-running COMPLETE/SKIPPED steps during idempotent resume. */
async function shouldSkipCompletedStep(
  db: DbClient,
  runId: string,
  step: ProvisionStepKey,
  stepResults: ProvisionStepResult[],
): Promise<boolean> {
  const status = await getStepStatus(db, runId, step)
  if (status === "COMPLETE" || status === "SKIPPED") {
    stepResults.push({ step, status })
    return true
  }
  return false
}

async function setTenantLifecycle(
  db: DbClient,
  tenantId: string | null | undefined,
  patch: { status: string; is_active: boolean },
) {
  if (!tenantId) return
  await db
    .from("tenants")
    .update({ ...patch, updated_at: nowIso() })
    .eq("id", tenantId)
}

export async function provisionHospital(
  db: DbClient,
  input: ProvisionHospitalInput,
): Promise<ProvisionHospitalResult> {
  const mode: ProvisionMode = input.mode ?? "REAL"
  const slug =
    mode === "SYNTHETIC_ACCEPTANCE" && !input.slug
      ? HOSPITAL_CANONICAL_SLUG
      : slugify(input.slug || input.facilityName)
  const facilityName =
    mode === "SYNTHETIC_ACCEPTANCE" && !input.facilityName.trim() ? HOSPITAL_CANONICAL_NAME : input.facilityName.trim()
  const adminRole = input.facilityType === "laboratory" ? "lab_admin" : "hospital_admin"
  const adminEmail = input.adminEmail.trim().toLowerCase()
  const correlationId = crypto.randomUUID()
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `hospital:${mode}:${slug}:${adminEmail}`

  const warnings: string[] = []
  const stepResults: ProvisionStepResult[] = []

  // Idempotent resume
  const { data: existingRun } = await db
    .from("facility_provisioning_runs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existingRun?.status === "COMPLETE" && existingRun.tenant_id) {
    await db
      .from("facility_provisioning_runs")
      .update({
        failure_code: null,
        failed_at: null,
        metadata: { ...(existingRun.metadata ?? {}), last_error: null },
        updated_at: nowIso(),
      })
      .eq("id", existingRun.id)
    const [{ data: steps }, { data: existingInvite }] = await Promise.all([
      db
        .from("facility_provisioning_steps")
        .select("step, status, error_code, safe_error_message, evidence")
        .eq("run_id", existingRun.id),
      db
        .from("facility_invitations")
        .select("invite_token, status")
        .eq("run_id", existingRun.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    return {
      ok: true,
      runId: existingRun.id,
      tenantId: existingRun.tenant_id,
      hospitalId: existingRun.hospital_id,
      slug: existingRun.slug,
      status: "COMPLETE",
      correlationId: existingRun.correlation_id,
      steps: (steps ?? []).map((s: Record<string, unknown>) => ({
        step: s.step as ProvisionStepKey,
        status: s.status as ProvisionStepStatus,
        errorCode: (s.error_code as string) ?? null,
        safeErrorMessage: (s.safe_error_message as string) ?? null,
        evidence: (s.evidence as Record<string, unknown>) ?? {},
      })),
      warnings: ["Idempotent replay — existing COMPLETE run returned"],
      inviteToken: (existingInvite?.invite_token as string | undefined) ?? null,
      inviteStatus: (existingInvite?.status as string | undefined) ?? null,
    }
  }

  let runId = existingRun?.id as string | undefined
  if (!runId) {
    const { data: created, error: createErr } = await db
      .from("facility_provisioning_runs")
      .insert({
        created_by: input.createdBy,
        mode,
        status: "PENDING",
        current_step: "validate",
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
        slug,
        facility_name: facilityName,
        ownership: input.ownership,
        facility_level: input.facilityLevel,
        metadata: {
          facility_type: input.facilityType ?? "hospital",
          modules: input.modules ?? defaultModulesForLevel(input.facilityLevel),
          contact: {
            name: input.contactName ?? input.adminName,
            email: input.contactEmail ?? adminEmail,
            phone: input.contactPhone ?? input.adminPhone ?? null,
          },
          city: input.city ?? null,
          district: input.district ?? null,
          country: input.country ?? "UG",
          bed_capacity: input.bedCapacity ?? null,
          tier: input.tier ?? "trial",
        },
        started_at: nowIso(),
      })
      .select("id")
      .single()
    if (createErr || !created) {
      return {
        ok: false,
        runId: "",
        tenantId: null,
        hospitalId: null,
        slug,
        status: "FAILED",
        correlationId,
        steps: [],
        warnings: [],
        error: createErr?.message ?? "Failed to create provisioning run",
      }
    }
    runId = created.id as string
  }

  let tenantId: string | null = existingRun?.tenant_id ?? null
  let hospitalId: string | null = existingRun?.hospital_id ?? null
  let inviteToken: string | null = null
  let inviteStatus: string | null = null

  // ── validate ──────────────────────────────────────────────────────────
  await beginStep(db, runId!, "validate")
  if (!facilityName || !slug || RESERVED_FACILITY_SLUGS.has(slug) || !adminEmail || !input.adminName?.trim()) {
    await failStep(db, runId!, "validate", "VALIDATION", "Facility name, slug, admin name and email are required")
    await failRun(db, runId!, "VALIDATION", "Missing required fields")
    return failResult(runId!, slug, correlationId, "Missing required fields")
  }
  if (!FACILITY_OWNERSHIP.includes(input.ownership)) {
    await failStep(db, runId!, "validate", "INVALID_OWNERSHIP", "Invalid ownership classification")
    await failRun(db, runId!, "INVALID_OWNERSHIP", "Invalid ownership")
    return failResult(runId!, slug, correlationId, "Invalid ownership")
  }
  if (!FACILITY_LEVELS.includes(input.facilityLevel)) {
    await failStep(db, runId!, "validate", "INVALID_LEVEL", "Invalid facility level")
    await failRun(db, runId!, "INVALID_LEVEL", "Invalid facility level")
    return failResult(runId!, slug, correlationId, "Invalid facility level")
  }

  const { data: slugConflict } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle()
  if (slugConflict && slugConflict.id !== tenantId) {
    await failStep(db, runId!, "validate", "SLUG_TAKEN", `Subdomain "${slug}" is already taken`)
    await failRun(db, runId!, "SLUG_TAKEN", `Subdomain "${slug}" is already taken`)
    return failResult(runId!, slug, correlationId, `Subdomain "${slug}" is already taken`)
  }
  await completeStep(db, runId!, "validate", { slug, ownership: input.ownership, facilityLevel: input.facilityLevel })
  stepResults.push({ step: "validate", status: "COMPLETE" })

  // ── core_tenant ───────────────────────────────────────────────────────
  await beginStep(db, runId!, "core_tenant")
  if (!tenantId) {
    tenantId = crypto.randomUUID()
    const isSynthetic = mode === "SYNTHETIC_ACCEPTANCE"
    const tenantRow = {
      id: tenantId,
      slug,
      name: facilityName,
      country: input.country ?? "UG",
      district: input.district || null,
      facility_type: input.facilityType ?? "hospital",
      bed_capacity: input.bedCapacity ?? null,
      phone: input.contactPhone || input.adminPhone || null,
      email: input.contactEmail || adminEmail,
      plan: input.tier ?? "trial",
      is_synthetic: isSynthetic,
      environment: isSynthetic ? "demo" : "production",
      // Never appear ACTIVE until finalize succeeds
      status: "provisioning",
      is_active: false,
      default_subdomain: slug,
      modules_enabled: normalizeModuleKeys(input.modules ?? defaultModulesForLevel(input.facilityLevel)),
      onboarding_completed: false,
      onboarding_step: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const { error: tenantErr } = await db.from("tenants").insert(tenantRow)
    if (tenantErr) {
      // Fallback minimal insert — still inactive until finalize
      const { error: minErr } = await db.from("tenants").insert({
        id: tenantId,
        slug,
        name: facilityName,
        facility_type: input.facilityType ?? "hospital",
        status: "provisioning",
        is_active: false,
      })
      if (minErr) {
        await failStep(db, runId!, "core_tenant", "TENANT_INSERT", minErr.message)
        await failRun(db, runId!, "TENANT_INSERT", minErr.message, tenantId)
        return failResult(runId!, slug, correlationId, minErr.message)
      }
      warnings.push("Tenant created with minimal columns")
    }
    // Mark synthetic protection in tenants metadata if column exists — store in hospitals.settings too
    await db
      .from("facility_provisioning_runs")
      .update({
        tenant_id: tenantId,
        metadata: {
          ...(existingRun?.metadata ?? {}),
          is_synthetic: isSynthetic,
          protected_from_billing: isSynthetic,
          protected_from_external_reporting: isSynthetic,
          protected_from_patient_notifications: isSynthetic,
        },
        updated_at: nowIso(),
      })
      .eq("id", runId)
  } else {
    // Resume: keep inactive until finalize
    await setTenantLifecycle(db, tenantId, { status: "provisioning", is_active: false })
  }
  await completeStep(db, runId!, "core_tenant", { tenantId })
  stepResults.push({ step: "core_tenant", status: "COMPLETE", evidence: { tenantId } })

  // ── facility_profile ──────────────────────────────────────────────────
  await beginStep(db, runId!, "facility_profile")
  hospitalId = tenantId
  const isSynthetic = mode === "SYNTHETIC_ACCEPTANCE"
  const modules = normalizeModuleKeys(input.modules ?? defaultModulesForLevel(input.facilityLevel))
  const { data: existingHospital } = await db.from("hospitals").select("id").eq("id", hospitalId).maybeSingle()
  if (!existingHospital) {
    const { error: hospErr } = await db.from("hospitals").insert({
      id: hospitalId,
      name: facilityName,
      subdomain: slug,
      type: hospitalsTypeFromLevel(input.facilityLevel),
      facility_kind: input.facilityType === "laboratory" ? "laboratory" : "hospital",
      settings: {
        tenant_id: tenantId,
        facility_type: input.facilityType ?? "hospital",
        ownership: input.ownership,
        facility_level: input.facilityLevel,
        city: input.city || null,
        district: input.district || null,
        beds_count: input.bedCapacity ?? null,
        contact_email: input.contactEmail || adminEmail,
        contact_name: input.contactName || input.adminName,
        contact_phone: input.contactPhone || input.adminPhone || null,
        subscription_tier: input.tier ?? "trial",
        source: "platform_onboarding",
        is_synthetic: isSynthetic,
        protected_from_billing: isSynthetic,
        protected_from_external_reporting: isSynthetic,
        protected_from_patient_notifications: isSynthetic,
        test_only: isSynthetic,
      },
    })
    if (hospErr) {
      await failStep(db, runId!, "facility_profile", "HOSPITAL_INSERT", hospErr.message)
      await failRun(db, runId!, "HOSPITAL_INSERT", hospErr.message)
      return failResult(runId!, slug, correlationId, hospErr.message, tenantId, null, stepResults)
    }
  }
  await db
    .from("facility_provisioning_runs")
    .update({ hospital_id: hospitalId, updated_at: nowIso() })
    .eq("id", runId)
  await completeStep(db, runId!, "facility_profile", { hospitalId })
  stepResults.push({ step: "facility_profile", status: "COMPLETE", evidence: { hospitalId } })

  // ── modules ───────────────────────────────────────────────────────────
  await beginStep(db, runId!, "modules")
  {
    const moduleRows = modules.map((moduleKey) => ({
      hospital_id: hospitalId,
      tenant_id: tenantId,
      module_key: moduleKey,
      is_active: true,
      activated_at: nowIso(),
    }))
    const { error: modErr } = await db
      .from("hospital_modules")
      .upsert(moduleRows, { onConflict: "hospital_id,module_key" })
    if (modErr) {
      await failStep(db, runId!, "modules", "MODULES_UPSERT", modErr.message)
      await failRun(db, runId!, "MODULES_UPSERT", modErr.message)
      return failResult(runId!, slug, correlationId, modErr.message, tenantId, hospitalId, stepResults)
    }
    // Best-effort feature_flags (legacy mirror) — warn if fails, do not fail run
    const flagRows = modules.map((feature_key) => ({
      tenant_id: tenantId,
      feature_key,
      is_enabled: true,
      enabled_by: input.createdBy,
      enabled_at: nowIso(),
      notes: "Enabled during hospital onboarding (canonical key).",
    }))
    const { error: flagErr } = await db
      .from("feature_flags")
      .upsert(flagRows, { onConflict: "tenant_id,feature_key" })
    if (flagErr) warnings.push(`feature_flags: ${flagErr.message}`)
  }
  await completeStep(db, runId!, "modules", { modules })
  stepResults.push({ step: "modules", status: "COMPLETE", evidence: { modules } })

  // ── departments ───────────────────────────────────────────────────────
  await beginStep(db, runId!, "departments")
  {
    const deptDefs =
      input.facilityType === "laboratory"
        ? HOSPITAL_DEPARTMENTS.filter(d => ["reception", "laboratory", "billing"].includes(d.code))
        : mode === "SYNTHETIC_ACCEPTANCE"
        ? HOSPITAL_DEPARTMENTS
        : HOSPITAL_DEPARTMENTS.filter((d) =>
            ["administration", "reception", "triage", "opd", "laboratory", "pharmacy", "billing"].includes(d.code),
          )
    let created = 0
    for (const d of deptDefs) {
      const { data: existing } = await db
        .from("departments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", d.name)
        .maybeSingle()
      if (existing) continue
      const { error } = await db.from("departments").insert({
        hospital_id: hospitalId,
        tenant_id: tenantId,
        name: d.name,
        dept_type: d.deptType,
        is_active: d.classification !== "NOT_IMPLEMENTED",
      })
      if (error) {
        await failStep(db, runId!, "departments", "DEPARTMENT_INSERT", error.message)
        await failRun(db, runId!, "DEPARTMENT_INSERT", error.message)
        return failResult(runId!, slug, correlationId, error.message, tenantId, hospitalId, stepResults)
      }
      created += 1
    }
    await completeStep(db, runId!, "departments", { created, total: deptDefs.length })
    stepResults.push({ step: "departments", status: "COMPLETE", evidence: { created, total: deptDefs.length } })
  }

  // ── locations ─────────────────────────────────────────────────────────
  await beginStep(db, runId!, "locations")
  {
    let created = 0
    const locations = input.facilityType === "laboratory" ? HOSPITAL_LOCATIONS.filter(loc => /lab|reception|billing/i.test(loc.code)) : HOSPITAL_LOCATIONS
    for (const loc of locations) {
      const { data: existing } = await db
        .from("facility_locations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("code", loc.code)
        .maybeSingle()
      if (existing) continue
      const { error } = await db.from("facility_locations").insert({
        tenant_id: tenantId,
        hospital_id: hospitalId,
        code: loc.code,
        name: loc.name,
        location_type: loc.locationType,
        floor: loc.floor ?? null,
        building: loc.building ?? null,
        is_active: true,
        is_synthetic: isSynthetic,
      })
      if (error) {
        await failStep(db, runId!, "locations", "LOCATION_INSERT", error.message)
        await failRun(db, runId!, "LOCATION_INSERT", "Location setup failed", tenantId)
        return failResult(runId!, slug, correlationId, "Location setup failed", tenantId, hospitalId, stepResults)
      }
      created += 1
    }
    await completeStep(db, runId!, "locations", { created, total: HOSPITAL_LOCATIONS.length })
    stepResults.push({ step: "locations", status: "COMPLETE", evidence: { created } })
  }

  // ── subscription ──────────────────────────────────────────────────────
  await beginStep(db, runId!, "subscription")
  {
    const targetPlanSlug = PLAN_SLUG_MAP[input.tier ?? "trial"] ?? "hospital_starter"
    const { data: planRow } = await db
      .from("subscription_plans")
      .select("id")
      .eq("slug", targetPlanSlug)
      .eq("is_active", true)
      .maybeSingle()
    if (!planRow?.id) {
      await failStep(db, runId!, "subscription", "SUBSCRIPTION_PLAN_MISSING", "No matching subscription plan")
      stepResults.push({ step: "subscription", status: "FAILED", errorCode: "SUBSCRIPTION_PLAN_MISSING", safeErrorMessage: "No matching subscription plan" })
    } else if (isSynthetic) {
      // Record protected subscription metadata without live billing
      const { error } = await db.from("tenant_subscriptions").upsert(
        {
          tenant_id: tenantId,
          plan_id: planRow.id,
          status: "trialing",
          starts_at: nowIso(),
          trial_ends: new Date(Date.now() + 30 * 86400000).toISOString(),
          current_period_start: nowIso(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        { onConflict: "tenant_id" },
      )
      if (error) {
        await failStep(db, runId!, "subscription", "SUBSCRIPTION_UPSERT", "Subscription setup failed")
        stepResults.push({ step: "subscription", status: "FAILED", errorCode: "SUBSCRIPTION_UPSERT", safeErrorMessage: "Subscription setup failed" })
      } else {
        await completeStep(db, runId!, "subscription", { planId: planRow.id, protected: true })
        stepResults.push({ step: "subscription", status: "COMPLETE" })
      }
    } else {
      const trialDays = (input.tier ?? "trial") === "trial" ? 30 : 14
      const trialEnd = new Date(Date.now() + trialDays * 86400000).toISOString()
      const { error } = await db.from("tenant_subscriptions").upsert(
        {
          tenant_id: tenantId,
          plan_id: planRow.id,
          status: (input.tier ?? "trial") === "trial" ? "trialing" : "active",
          starts_at: nowIso(),
          trial_ends: (input.tier ?? "trial") === "trial" ? trialEnd : null,
          current_period_start: nowIso(),
          current_period_end: trialEnd,
        },
        { onConflict: "tenant_id" },
      )
      if (error) {
        await failStep(db, runId!, "subscription", "SUBSCRIPTION_UPSERT", error.message)
        warnings.push(`subscription: ${error.message}`)
        // Non-fatal for core readiness
        stepResults.push({ step: "subscription", status: "FAILED", errorCode: "SUBSCRIPTION_UPSERT", safeErrorMessage: error.message })
      } else {
        await completeStep(db, runId!, "subscription", { planId: planRow.id })
        stepResults.push({ step: "subscription", status: "COMPLETE" })
      }
    }
  }

  // ── administrator ─────────────────────────────────────────────────────
  await beginStep(db, runId!, "administrator")
  let profileId: string | null = null
  {
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id, tenant_id, role")
      .eq("email", adminEmail)
      .maybeSingle()

    if (existingProfile) {
      if (existingProfile.tenant_id !== tenantId || ["platform_admin", "superadmin", "platform_observer"].includes(existingProfile.role)) {
        await failStep(
          db,
          runId!,
          "administrator",
          "EMAIL_IN_USE",
          `Email ${adminEmail} already belongs to another facility`,
        )
        await failRun(db, runId!, "EMAIL_IN_USE", `Email ${adminEmail} already registered`)
        return failResult(runId!, slug, correlationId, `Email ${adminEmail} already registered`, tenantId, hospitalId, stepResults)
      }
      // Link membership
      await db
        .from("profiles")
        .update({
          tenant_id: tenantId,
          hospital_id: hospitalId,
          role: adminRole,
          is_admin: true,
          must_change_password: true,
          updated_at: nowIso(),
        })
        .eq("id", existingProfile.id)
      profileId = existingProfile.id
      warnings.push("Existing profile linked as hospital_admin")
    } else {
      profileId = crypto.randomUUID()
      const nameParts = input.adminName.trim().split(/\s+/)
      const { error: profileErr } = await db.from("profiles").insert({
        id: profileId,
        email: adminEmail,
        full_name: input.adminName.trim(),
        first_name: nameParts[0] ?? "Hospital",
        last_name: nameParts.slice(1).join(" ") || "Admin",
        role: adminRole,
        tenant_id: tenantId,
        hospital_id: hospitalId,
        is_admin: true,
        must_change_password: true,
        verification_status: "verified",
        phone: input.adminPhone || input.contactPhone || null,
        onboarding_complete: false,
      })
      if (profileErr) {
        await failStep(db, runId!, "administrator", "PROFILE_INSERT", profileErr.message)
        await failRun(db, runId!, "PROFILE_INSERT", profileErr.message)
        return failResult(runId!, slug, correlationId, profileErr.message, tenantId, hospitalId, stepResults)
      }
    }
    await completeStep(db, runId!, "administrator", { profileId, email: adminEmail })
    stepResults.push({ step: "administrator", status: "COMPLETE", evidence: { profileId } })
  }

  // ── invitation ────────────────────────────────────────────────────────
  await beginStep(db, runId!, "invitation")
  {
    const { data: existingInvite } = await db
      .from("facility_invitations")
      .select("id, invite_token, status, expires_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingInvite?.invite_token) {
      inviteToken = existingInvite.invite_token
      inviteStatus = existingInvite.status
      await completeStep(db, runId!, "invitation", {
        inviteId: existingInvite.id,
        status: existingInvite.status,
        resumed: true,
      })
      stepResults.push({
        step: "invitation",
        status: "COMPLETE",
        evidence: { inviteId: existingInvite.id, resumed: true },
      })
    } else {
    inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
    const { data: invite, error: inviteErr } = await db
      .from("facility_invitations")
      .insert({
        tenant_id: tenantId,
        run_id: runId,
        email: adminEmail,
        full_name: input.adminName.trim(),
        role: adminRole,
        invite_token: inviteToken,
        status: "PENDING",
        expires_at: expiresAt,
        profile_id: profileId,
        created_by: input.createdBy,
      })
      .select("id, status")
      .single()

    if (inviteErr) {
      await failStep(db, runId!, "invitation", "INVITE_INSERT", inviteErr.message)
      warnings.push(`invitation: ${inviteErr.message}`)
      inviteStatus = "FAILED"
      stepResults.push({
        step: "invitation",
        status: "FAILED",
        errorCode: "INVITE_INSERT",
        safeErrorMessage: inviteErr.message,
      })
    } else {
      inviteStatus = invite.status
      await completeStep(db, runId!, "invitation", {
        inviteId: invite.id,
        status: "PENDING",
        expiresAt,
      })
      stepResults.push({ step: "invitation", status: "COMPLETE", evidence: { inviteId: invite.id } })
    }
    }
  }

  // ── synthetic_staff ───────────────────────────────────────────────────
  await beginStep(db, runId!, "synthetic_staff")
  if (mode === "SYNTHETIC_ACCEPTANCE" && input.facilityType !== "laboratory") {
    let staffCreated = 0
    for (const role of HOSPITAL_STAFF_ROLES) {
      if (role.code === "hosp_admin") continue // already created
      const email = `${role.code}@${slug}.synapse-integrated.local`
      const { data: exists } = await db.from("profiles").select("id").eq("email", email).maybeSingle()
      if (exists) continue
      const { error } = await db.from("profiles").insert({
        id: crypto.randomUUID(),
        email,
        full_name: role.displayName,
        first_name: role.displayName.split(" ")[0] ?? role.code,
        last_name: "Demo",
        role: role.role,
        tenant_id: tenantId,
        hospital_id: hospitalId,
        is_admin: false,
        must_change_password: true,
        verification_status: "verified",
        onboarding_complete: false,
      })
      if (error) {
        warnings.push(`staff ${role.code}: ${error.message}`)
        continue
      }
      staffCreated += 1
    }
    await completeStep(db, runId!, "synthetic_staff", { staffCreated })
    stepResults.push({ step: "synthetic_staff", status: "COMPLETE", evidence: { staffCreated } })
  } else {
    await skipStep(db, runId!, "synthetic_staff", "REAL mode does not seed synthetic staff")
    stepResults.push({ step: "synthetic_staff", status: "SKIPPED" })
  }

  // ── synthetic_guards ──────────────────────────────────────────────────
  await beginStep(db, runId!, "synthetic_guards")
  if (mode === "SYNTHETIC_ACCEPTANCE") {
    await completeStep(db, runId!, "synthetic_guards", {
      protected_from_billing: true,
      protected_from_external_reporting: true,
      protected_from_patient_notifications: true,
      is_synthetic: true,
    })
    stepResults.push({ step: "synthetic_guards", status: "COMPLETE" })
  } else {
    await skipStep(db, runId!, "synthetic_guards", "REAL mode")
    stepResults.push({ step: "synthetic_guards", status: "SKIPPED" })
  }

  // Persist assignment before activation; DNS verification is a separate live check.
  await beginStep(db, runId!, "domain")
  const { error: domainError } = await db.from("facility_domain_records").upsert({
    tenant_id: tenantId, facility_id: hospitalId, hostname: `${slug}.synapseos.tech`,
    domain_type: "synapse_subdomain", target_project: "prj_ST72DC6VkMfhon3M1yW2PL575mcd",
    status: "REQUESTED", updated_at: nowIso(),
  }, { onConflict: "hostname" })
  if (domainError) {
    await failStep(db, runId!, "domain", "DOMAIN_RECORD", "Domain assignment failed")
    await failRun(db, runId!, "DOMAIN_RECORD", "Domain assignment failed", tenantId)
    return failResult(runId!, slug, correlationId, "Domain assignment failed", tenantId, hospitalId, stepResults)
  }
  await completeStep(db, runId!, "domain", { hostname: `${slug}.synapseos.tech` })
  stepResults.push({ step: "domain", status: "COMPLETE" })

  // ── finalize ──────────────────────────────────────────────────────────
  await beginStep(db, runId!, "finalize")
  const required = ["core_tenant", "facility_profile", "modules", "departments", "locations", "subscription", "administrator", "invitation", "domain"];
  const canActivate = provisioningCanActivate(stepResults, required);
  const finalStatus: ProvisionRunStatus = !canActivate ? "FAILED" : warnings.length ? "READY_WITH_WARNINGS" : "COMPLETE";

  await completeStep(db, runId!, "finalize", { finalStatus, warnings })
  stepResults.push({ step: "finalize", status: "COMPLETE", evidence: { finalStatus } })

  if (finalStatus === "FAILED") {
    await setTenantLifecycle(db, tenantId, { status: "suspended", is_active: false })
  } else {
    // Only successful provisioning becomes ACTIVE / operational
    await setTenantLifecycle(db, tenantId, { status: "active", is_active: true })
    if (tenantId) {
      await db
        .from("tenants")
        .update({ onboarding_completed: true, onboarding_step: 99, updated_at: nowIso() })
        .eq("id", tenantId)
    }
  }

  await db
    .from("facility_provisioning_runs")
    .update({
      status: finalStatus,
      completed_at: finalStatus === "FAILED" ? null : nowIso(),
      failure_code: finalStatus === "FAILED" ? existingRun?.failure_code ?? null : null,
      failed_at: finalStatus === "FAILED" ? nowIso() : null,
      current_step: "finalize",
      metadata: { ...(existingRun?.metadata ?? {}), last_error: finalStatus === "FAILED" ? existingRun?.metadata?.last_error ?? null : null },
      updated_at: nowIso(),
    })
    .eq("id", runId)

  return {
    ok: finalStatus !== "FAILED",
    runId: runId!,
    tenantId,
    hospitalId,
    slug,
    status: finalStatus,
    correlationId,
    steps: stepResults,
    inviteToken,
    inviteStatus,
    warnings,
  }
}

async function failRun(
  db: DbClient,
  runId: string,
  code: string,
  message: string,
  tenantId?: string | null,
) {
  const { data: run } = await db
    .from("facility_provisioning_runs")
    .select("tenant_id, metadata")
    .eq("id", runId)
    .maybeSingle()
  const tid = tenantId ?? run?.tenant_id ?? null
  await db
    .from("facility_provisioning_runs")
    .update({
      status: "FAILED",
      failure_code: code,
      failed_at: nowIso(),
      updated_at: nowIso(),
      metadata: { ...(run?.metadata ?? {}), last_error: message },
    })
    .eq("id", runId)
  // FAILED facilities must never appear operational
  await setTenantLifecycle(db, tid, { status: "suspended", is_active: false })
}

function failResult(
  runId: string,
  slug: string,
  correlationId: string,
  error: string,
  tenantId: string | null = null,
  hospitalId: string | null = null,
  steps: ProvisionStepResult[] = [],
): ProvisionHospitalResult {
  return {
    ok: false,
    runId,
    tenantId,
    hospitalId,
    slug,
    status: "FAILED",
    correlationId,
    steps,
    warnings: [],
    error,
  }
}


/**
 * Resume a FAILED/RUNNING facility provisioning run without duplicating tenant/facility.
 * Uses the existing run's idempotency_key and stored metadata.
 */
export async function resumeFacilityProvision(
  db: DbClient,
  runId: string,
  createdBy: string,
): Promise<ProvisionHospitalResult> {
  const detail = await getProvisionRun(db, runId)
  if (!detail?.run) {
    return {
      ok: false,
      runId,
      tenantId: null,
      hospitalId: null,
      slug: "",
      status: "FAILED",
      correlationId: crypto.randomUUID(),
      steps: [],
      warnings: [],
      error: "Provisioning run not found",
    }
  }
  const run = detail.run as Record<string, unknown>
  const meta = (run.metadata as Record<string, unknown>) ?? {}
  const contact = (meta.contact as Record<string, unknown>) ?? {}

  // Recover admin email if older failRun wiped contact metadata
  let adminEmail = contact.email ? String(contact.email).toLowerCase() : ""
  let adminName = contact.name ? String(contact.name) : ""
  if (!adminEmail && typeof run.idempotency_key === "string") {
    const parts = String(run.idempotency_key).split(":")
    const maybeEmail = parts[parts.length - 1] ?? ""
    if (maybeEmail.includes("@")) adminEmail = maybeEmail.toLowerCase()
  }
  if (!adminEmail && run.tenant_id) {
    const { data: tenant } = await db
      .from("tenants")
      .select("email, name")
      .eq("id", run.tenant_id)
      .maybeSingle()
    if (tenant?.email) adminEmail = String(tenant.email).toLowerCase()
    if (!adminName && tenant?.name) adminName = String(tenant.name)
  }
  if (!adminName) adminName = "Facility Admin"

  if (meta.facility_type === "pharmacy" || meta.facility_type === "laboratory") {
    const { provisionFacility } = await import("./facility-provision")
    return provisionFacility(db, {
      facilityType: meta.facility_type,
      facilityName: String(run.facility_name ?? ""), slug: String(run.slug ?? ""),
      adminName, adminEmail, createdBy,
      country: String(meta.country ?? "UG"),
      tier: (meta.tier as "trial" | "starter" | "professional" | "enterprise") || "trial",
      modules: Array.isArray(meta.modules) ? meta.modules.map(String) : undefined,
      licenseNumber: meta.license_number ? String(meta.license_number) : undefined,
      physicalAddress: meta.physical_address ? String(meta.physical_address) : undefined,
      mode: run.mode === "SYNTHETIC_ACCEPTANCE" ? "SYNTHETIC_ACCEPTANCE" : "REAL",
      idempotencyKey: String(run.idempotency_key ?? ""), sendInvite: true,
    })
  }

  // Clear failed step so retry can re-enter RUNNING
  const failedStep = detail.steps.find((s: Record<string, unknown>) => s.status === "FAILED")
  if (failedStep?.step) {
    await upsertStep(db, runId, failedStep.step as ProvisionStepKey, {
      status: "PENDING",
      error_code: null,
      safe_error_message: null,
    })
  }
  await db
    .from("facility_provisioning_runs")
    .update({
      status: "RUNNING",
      failure_code: null,
      failed_at: null,
      updated_at: nowIso(),
      metadata: {
        ...meta,
        contact: {
          name: adminName,
          email: adminEmail,
          phone: contact.phone ?? null,
        },
      },
    })
    .eq("id", runId)
  if (run.tenant_id) {
    await setTenantLifecycle(db, String(run.tenant_id), { status: "provisioning", is_active: false })
  }

  return provisionHospital(db, {
    facilityType: (meta.facility_type as ProvisionHospitalInput["facilityType"]) ?? "hospital",
    modules: Array.isArray(meta.modules) ? meta.modules.map(String) : undefined,
    facilityName: String(run.facility_name ?? ""),
    slug: String(run.slug ?? ""),
    country: meta.country ? String(meta.country) : "UG",
    district: meta.district ? String(meta.district) : undefined,
    city: meta.city ? String(meta.city) : undefined,
    ownership: String(run.ownership ?? "PUBLIC") as FacilityOwnership,
    facilityLevel: String(run.facility_level ?? "GENERAL_HOSPITAL") as FacilityLevel,
    bedCapacity: meta.bed_capacity != null ? Number(meta.bed_capacity) : undefined,
    contactName: adminName,
    contactEmail: adminEmail || undefined,
    contactPhone: contact.phone ? String(contact.phone) : undefined,
    adminName,
    adminEmail,
    adminPhone: contact.phone ? String(contact.phone) : undefined,
    tier: (meta.tier as "trial" | "starter" | "professional" | "enterprise") || "trial",
    mode: (String(run.mode) === "SYNTHETIC_ACCEPTANCE" ? "SYNTHETIC_ACCEPTANCE" : "REAL") as ProvisionMode,
    idempotencyKey: String(run.idempotency_key ?? ""),
    createdBy,
    sendInvite: true,
  })
}

export async function getProvisionRun(db: DbClient, runId: string) {
  const { data: run } = await db.from("facility_provisioning_runs").select("*").eq("id", runId).maybeSingle()
  if (!run) return null
  const { data: steps } = await db
    .from("facility_provisioning_steps")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
  const { data: invite } = await db
    .from("facility_invitations")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return { run, steps: steps ?? [], invite: invite ?? null }
}
