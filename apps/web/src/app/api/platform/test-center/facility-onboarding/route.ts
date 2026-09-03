import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { persistTestRun } from "@/lib/platform/test-center-store"
import {
  FACILITY_TYPES,
  defaultModulesForFacilityType,
  pharmacyLoginUrl,
} from "@synapse/db/facility-provision-catalog"

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

  steps.push(
    FACILITY_TYPES.length === 5
      ? pass("facility_types", "First-class facility types", { types: FACILITY_TYPES })
      : fail("facility_types", "First-class facility types", "missing_types"),
  )

  const clinic = defaultModulesForFacilityType("clinic")
  steps.push(
    clinic.includes("opd") && !clinic.includes("theatre")
      ? pass("module_configuration", "Clinic module defaults lean", { clinic })
      : fail("module_configuration", "Clinic module defaults lean", "unexpected_modules", { clinic }),
  )

  const pharmacyMods = defaultModulesForFacilityType("pharmacy")
  steps.push(
    pharmacyMods.includes("pos") && pharmacyMods.includes("inventory")
      ? pass("pharmacy_modules", "Pharmacy capability defaults", { pharmacyMods })
      : fail("pharmacy_modules", "Pharmacy capability defaults", "missing_pos"),
  )

  const labMods = defaultModulesForFacilityType("laboratory")
  steps.push(
    labMods.includes("lab") && !labMods.includes("opd")
      ? pass("laboratory_modules", "Laboratory defaults exclude OPD/IPD", { labMods })
      : fail("laboratory_modules", "Laboratory defaults exclude OPD/IPD", "unexpected"),
  )

  steps.push(
    pharmacyLoginUrl("pharm-acme").includes("pharm.synapseos.tech/login?tenant=")
      ? pass("pharmacy_login_strategy", "Pharmacy tenant routing strategy", {
          url: pharmacyLoginUrl("pharm-acme"),
        })
      : fail("pharmacy_login_strategy", "Pharmacy tenant routing strategy", "wrong_url"),
  )

  try {
    const { data: indexes } = await db.rpc("exec_sql", { query: "select 1" }).maybeSingle?.()
    void indexes
  } catch {
    /* rpc may not exist — use department evidence instead */
  }

  const { data: labs } = await db
    .from("departments")
    .select("tenant_id, name")
    .ilike("name", "Laboratory")
    .not("tenant_id", "is", null)
    .limit(20)

  const tenantIds = new Set((labs ?? []).map((r: { tenant_id: string }) => r.tenant_id))
  steps.push(
    tenantIds.size >= 2
      ? pass("department_names_are_tenant_scoped", "Cross-tenant Laboratory departments exist", {
          tenantCount: tenantIds.size,
        })
      : fail(
          "department_names_are_tenant_scoped",
          "Cross-tenant Laboratory departments exist",
          "need_two_tenants_with_laboratory",
          { tenantCount: tenantIds.size },
        ),
  )

  const { data: failedActive } = await db
    .from("facility_provisioning_runs")
    .select("id, tenant_id, status")
    .eq("status", "FAILED")
    .limit(20)

  let failedFacilityNotActive = true
  for (const run of failedActive ?? []) {
    if (!run.tenant_id) continue
    const { data: t } = await db.from("tenants").select("is_active, status").eq("id", run.tenant_id).maybeSingle()
    if (t?.is_active === true && t?.status === "active") {
      failedFacilityNotActive = false
      steps.push(
        fail("failed_facility_not_active", "Failed provisioning not ACTIVE", "active_after_fail", {
          runId: run.id,
          tenantId: run.tenant_id,
        }),
      )
      break
    }
  }
  if (failedFacilityNotActive) {
    steps.push(pass("failed_facility_not_active", "Failed provisioning not ACTIVE", { checked: (failedActive ?? []).length }))
  }

  const { data: ebrine } = await db.from("tenants").select("id, status, is_active").eq("slug", "ebrinetest").maybeSingle()
  const { data: demo } = await db
    .from("tenants")
    .select("id, status, is_active")
    .eq("slug", "synapse-integrated-demo")
    .maybeSingle()
  steps.push(
    ebrine?.status === "active" && demo?.status === "active"
      ? pass("repaired_facilities_active", "Repaired facilities ACTIVE", {
          ebrinetest: ebrine,
          demo,
        })
      : fail("repaired_facilities_active", "Repaired facilities ACTIVE", "not_active", { ebrine, demo }),
  )

  const { data: domainTable, error: domainErr } = await db.from("facility_domain_records").select("id").limit(1)
  steps.push(
    domainErr
      ? fail("domain_records", "facility_domain_records present", domainErr.message)
      : pass("domain_records", "facility_domain_records present", { rows: domainTable?.length ?? 0 }),
  )

  // Domain routing evidence — report actual Vercel gaps honestly (SKIPPED ≠ PASS)
  steps.push(
    fail(
      "wildcard_ingress",
      "Wildcard *.synapseos.tech ingress",
      "NOT_CONFIGURED_ON_VERCEL",
      {
        evidence:
          "synpase-os project domains currently list synapseos.tech, www, admin, app only — no *.synapseos.tech",
        requiredAction: "Add *.synapseos.tech to Vercel project prj_ST72DC6VkMfhon3M1yW2PL575mcd and DNS CNAME * → cname.vercel-dns.com",
      },
    ),
  )

  const status = steps.some((s) => s.status === "FAIL") ? "FAIL" : "PASS"
  const completedAt = new Date().toISOString()
  const run = {
    testRunId: crypto.randomUUID(),
    module: "facility-onboarding",
    environment: process.env.VERCEL_ENV ?? "local",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    startedAt: new Date(started).toISOString(),
    completedAt,
    durationMs: Date.now() - started,
    status: status as "PASS" | "FAIL",
    error: status === "FAIL" ? steps.filter((s) => s.status === "FAIL").map((s) => s.id).join(",") : null,
    evidence: { steps, correlationId },
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
  }

  await persistTestRun(run, auth.profile.id)
  return NextResponse.json(run, { status: status === "PASS" ? 200 : 400 })
}
