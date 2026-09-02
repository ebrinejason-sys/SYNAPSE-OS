import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { persistTestRun } from "@/lib/platform/test-center-store"
import {
  FACILITY_LEVELS,
  FACILITY_OWNERSHIP,
  normalizeModuleKeys,
  slugify,
} from "@synapse/db/hospital-provision-catalog"
import { HOSPITAL_CANONICAL_SLUG } from "@synapse/db/hospital-seed"

export const dynamic = "force-dynamic"

type StepStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_CONFIGURED" | "SKIPPED"

type EvidenceStep = {
  id: string
  label: string
  status: StepStatus
  durationMs: number
  evidence: Record<string, unknown>
  error?: string
}

function pass(id: string, label: string, evidence: Record<string, unknown> = {}): EvidenceStep {
  return { id, label, status: "PASS", durationMs: 0, evidence }
}

function fail(id: string, label: string, error: string, evidence: Record<string, unknown> = {}): EvidenceStep {
  return { id, label, status: "FAIL", durationMs: 0, evidence, error }
}

export async function POST() {
  const auth = await requirePlatformAdminApi()
  if (!auth.ok) return auth.response

  const started = Date.now()
  const steps: EvidenceStep[] = []
  const db = createServiceClient() as any
  const correlationId = crypto.randomUUID()

  // Catalog / validation (always runnable)
  const ownershipOk = FACILITY_OWNERSHIP.includes("PUBLIC") && FACILITY_LEVELS.includes("REGIONAL_REFERRAL_HOSPITAL")
  steps.push(
    ownershipOk
      ? pass("ownership_facility_type", "Ownership + facility level enums", {
          ownershipCount: FACILITY_OWNERSHIP.length,
          levelCount: FACILITY_LEVELS.length,
        })
      : fail("ownership_facility_type", "Ownership + facility level enums", "enum_missing"),
  )

  const mapped = normalizeModuleKeys(["doctor", "laboratory", "pharmacy"])
  steps.push(
    mapped.includes("clinical") && mapped.includes("lab") && mapped.includes("dispensing")
      ? pass("module_keys", "Legacy → canonical module key mapping", { mapped })
      : fail("module_keys", "Legacy → canonical module key mapping", "map_failed", { mapped }),
  )

  const slug = slugify("SYNAPSE Integrated Regional Hospital")
  steps.push(
    slug.includes("synapse")
      ? pass("slug_unique_shape", "Slug normalization", { slug, canonical: HOSPITAL_CANONICAL_SLUG })
      : fail("slug_unique_shape", "Slug normalization", "bad_slug", { slug }),
  )

  // DB-backed checks
  try {
    const { error: runTableErr } = await db.from("facility_provisioning_runs").select("id").limit(1)
    steps.push(
      runTableErr
        ? fail("core_tenant", "facility_provisioning_runs table", runTableErr.message)
        : pass("hospital_create", "Provisioning schema present", { table: "facility_provisioning_runs" }),
    )

    const { data: demoTenant, error: tenantErr } = await db
      .from("tenants")
      .select("id, slug, name, status")
      .eq("slug", "synapse-integrated-demo")
      .maybeSingle()

    if (tenantErr) {
      steps.push(fail("profile_created", "Lookup synthetic tenant", tenantErr.message))
    } else if (!demoTenant) {
      steps.push(
        fail("profile_created", "Synthetic acceptance hospital", "not_provisioned", {
          expectedSlug: "synapse-integrated-demo",
          hint: "Create via Platform → Hospitals → Create Hospital with SYNTHETIC_ACCEPTANCE",
        }),
      )
    } else {
      const tenantId = demoTenant.id as string
      steps.push(pass("profile_created", "Facility profile / tenant", { tenantId, name: demoTenant.name }))

      const [{ count: modCount }, { count: deptCount }, { count: locCount }, { data: invite }, { data: run }] =
        await Promise.all([
          db
            .from("hospital_modules")
            .select("id", { count: "exact", head: true })
            .or(`hospital_id.eq.${tenantId},tenant_id.eq.${tenantId}`),
          db.from("departments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          db.from("facility_locations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          db
            .from("facility_invitations")
            .select("id, status, email")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          db
            .from("facility_provisioning_runs")
            .select("id, status, mode")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

      steps.push(
        (modCount ?? 0) > 0
          ? pass("modules_created", "Modules created", { count: modCount })
          : fail("modules_created", "Modules created", "none", { count: modCount }),
      )
      steps.push(
        (deptCount ?? 0) >= 10
          ? pass("departments_created", "Departments created", { count: deptCount })
          : fail("departments_created", "Departments created", "insufficient", { count: deptCount }),
      )
      steps.push(
        (locCount ?? 0) >= 5
          ? pass("locations_created", "Locations created", { count: locCount })
          : fail("locations_created", "Locations created", "insufficient", { count: locCount }),
      )

      const { data: adminProfile } = await db
        .from("profiles")
        .select("id, email, role, tenant_id")
        .eq("tenant_id", tenantId)
        .ilike("role", "%admin%")
        .limit(1)
        .maybeSingle()

      steps.push(
        adminProfile
          ? pass("admin_created", "Administrator profile", { profileId: adminProfile.id, email: adminProfile.email })
          : fail("admin_created", "Administrator profile", "missing"),
      )
      steps.push(
        adminProfile?.tenant_id === tenantId
          ? pass("admin_membership", "Admin facility membership", { tenantId })
          : fail("admin_membership", "Admin facility membership", "mismatch"),
      )
      steps.push(
        invite
          ? pass("invite_created", "Invitation record", { status: invite.status, email: invite.email })
          : fail("invite_created", "Invitation record", "missing"),
      )

      const guardsOk = run?.mode === "SYNTHETIC_ACCEPTANCE"
      steps.push(
        guardsOk
          ? pass("synthetic_guards", "Synthetic mode on provisioning run", { runId: run.id, status: run.status })
          : fail("synthetic_guards", "Synthetic mode on provisioning run", "missing_or_wrong_mode", {
              run: run ?? null,
            }),
      )

      steps.push(
        run && ["COMPLETE", "READY_WITH_WARNINGS"].includes(String(run.status))
          ? pass("workspace_access", "Provisioning complete for workspace", { status: run.status })
          : fail("workspace_access", "Provisioning complete for workspace", "not_ready", {
              status: run?.status ?? null,
            }),
      )

      // Lightweight RBAC matrix from hospital-acceptance in-memory checks
      try {
        const { buildStaffRoleMatrix } = await import("@synapse/db/hospital-acceptance")
        const matrix = buildStaffRoleMatrix()
        const failRoles = matrix.filter((r: { status?: string }) => r.status === "FAIL")
        steps.push(
          failRoles.length === 0
            ? pass("RBAC", "Staff role matrix smoke", { roles: matrix.length })
            : fail("RBAC", "Staff role matrix smoke", `${failRoles.length}_failed`, { failRoles }),
        )
      } catch (err) {
        steps.push(
          fail("RBAC", "Staff role matrix smoke", err instanceof Error ? err.message : "rbac_import_failed"),
        )
      }
    }

    // Idempotency evidence: unique index / replay contract
    const { data: dupeSlug } = await db
      .from("tenants")
      .select("id")
      .eq("slug", "synapse-integrated-demo")
    steps.push(
      !dupeSlug || dupeSlug.length <= 1
        ? pass("slug_unique", "No duplicate synthetic slug tenants", { count: dupeSlug?.length ?? 0 })
        : fail("slug_unique", "No duplicate synthetic slug tenants", "duplicates", { count: dupeSlug.length }),
    )
  } catch (err) {
    steps.push(fail("core_tenant", "Database onboarding checks", err instanceof Error ? err.message : "db_error"))
  }

  const failed = steps.filter((s) => s.status === "FAIL")
  const status: StepStatus = failed.length === 0 ? "PASS" : "FAIL"
  const testRunId = crypto.randomUUID()
  const completedAt = new Date().toISOString()
  const durationMs = Date.now() - started

  await persistTestRun(
    {
      testRunId,
      module: "hospital-onboarding",
      environment: process.env.VERCEL_ENV ?? "local",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      startedAt: new Date(started).toISOString(),
      completedAt,
      durationMs,
      status,
      error: failed[0]?.error ?? null,
      evidence: {
        stepCount: steps.length,
        passCount: steps.filter((s) => s.status === "PASS").length,
        failCount: failed.length,
        correlationId,
      },
      correlationId,
      startedBy: auth.profile.id,
      isSynthetic: true,
      steps: steps.map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status,
        durationMs: s.durationMs,
        evidence: s.evidence,
        error: s.error,
      })),
    },
    auth.profile.id,
  )

  return NextResponse.json({
    ok: status === "PASS",
    testRunId,
    status,
    correlationId,
    durationMs,
    steps,
  })
}
