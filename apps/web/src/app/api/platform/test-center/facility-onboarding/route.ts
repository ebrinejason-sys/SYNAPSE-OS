import { NextResponse } from "next/server"
import { facilitySlugFromHost, lookupActiveTenant } from "@/lib/tenant-routing"
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

  // Probe production ingress instead of asserting a stale deployment snapshot.
  const probe = async (host: string, headers?: Record<string, string>) => {
    try {
      const response = await fetch(`https://${host}/`, { redirect: "manual", cache: "no-store", headers, signal: AbortSignal.timeout(10000) })
      return { status: response.status, location: response.headers.get("location") }
    } catch { return { status: 0, location: null } }
  }
  const [known, unknown] = await Promise.all([probe("domain-test.synapseos.tech"), probe("unknown-random.synapseos.tech")])
  steps.push(known.status > 0 && unknown.status > 0
    ? pass("wildcard_ingress", "Wildcard HTTPS ingress", { known, unknown })
    : fail("wildcard_ingress", "Wildcard HTTPS ingress", "HTTPS_PROBE_FAILED", { known, unknown }))
  steps.push(unknown.status === 404
    ? pass("unknown_tenant_failure", "Unknown tenant fails closed", { unknown })
    : fail("unknown_tenant_failure", "Unknown tenant fails closed", "EXPECTED_404", { unknown }))
  const knownTenant = await lookupActiveTenant("domain-test", { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY })
  steps.push(knownTenant && known.status === 307 && known.location?.startsWith("/login")
    ? pass("known_tenant_resolution", "Known tenant resolves to login", { tenantId: knownTenant.id, known })
    : fail("known_tenant_resolution", "Known tenant resolves to login", "DOMAIN_TEST_NOT_VERIFIED", { known }))

  const acceptanceSlugs = ["domain-test", "synapse-acceptance-hospital-two", "pharm-synapse-acceptance-pharmacy", "synapse-pilot-lab"]
  const { data: acceptanceTenants } = await db
    .from("tenants")
    .select("id, slug, facility_type, status, is_active")
    .in("slug", acceptanceSlugs)
  type AcceptanceTenant = { id: string; slug: string; facility_type: string; status: string; is_active: boolean }
  const tenantsBySlug = new Map<string, AcceptanceTenant>((acceptanceTenants ?? []).map((tenant: AcceptanceTenant) => [tenant.slug, tenant]))
  const pharmacyTenant = tenantsBySlug.get("pharm-synapse-acceptance-pharmacy")
  const labTenant = tenantsBySlug.get("synapse-pilot-lab")
  const hospitalTenants = [tenantsBySlug.get("domain-test"), tenantsBySlug.get("synapse-acceptance-hospital-two")].filter(Boolean) as AcceptanceTenant[]
  const targetIds = (acceptanceTenants ?? []).map((tenant: Record<string, unknown>) => String(tenant.id))

  const [{ data: pharmacyRuns }, { data: pharmacyStores }, { data: invitations }] = await Promise.all([
    pharmacyTenant ? db.from("facility_provisioning_runs").select("id, status, failure_code, failed_at").eq("tenant_id", pharmacyTenant.id) : Promise.resolve({ data: [] }),
    pharmacyTenant ? db.from("pharmacy_stores").select("id").eq("tenant_id", pharmacyTenant.id).eq("is_deleted", false) : Promise.resolve({ data: [] }),
    targetIds.length ? db.from("facility_invitations").select("tenant_id, status, invite_token, sent_at, accepted_at").in("tenant_id", targetIds) : Promise.resolve({ data: [] }),
  ])
  const retryPass = pharmacyTenant?.is_active === true && pharmacyRuns?.length === 1 && pharmacyRuns[0]?.status === "COMPLETE" && !pharmacyRuns[0]?.failure_code && pharmacyStores?.length === 1
  steps.push(retryPass
    ? pass("idempotent_retry", "Idempotent retry", { runCount: pharmacyRuns.length, storeCount: pharmacyStores.length, runStatus: pharmacyRuns[0].status })
    : fail("idempotent_retry", "Idempotent retry", "LIVE_RETRY_EVIDENCE_INCOMPLETE", { runCount: pharmacyRuns?.length ?? 0, storeCount: pharmacyStores?.length ?? 0, run: pharmacyRuns?.[0] ?? null }))

  const invitedTenantIds = new Set((invitations ?? []).filter((invite: Record<string, unknown>) =>
    Boolean(invite.invite_token) && ["SENT", "ACCEPTED"].includes(String(invite.status)),
  ).map((invite: Record<string, unknown>) => String(invite.tenant_id)))
  steps.push(targetIds.length === 4 && targetIds.every((id: string) => invitedTenantIds.has(id))
    ? pass("secure_admin_invitation", "Secure admin invitation", { tenantCount: invitedTenantIds.size, statuses: (invitations ?? []).map((invite: Record<string, unknown>) => invite.status) })
    : fail("secure_admin_invitation", "Secure admin invitation", "INVITATION_NOT_SENT", { expected: targetIds.length, sentOrAccepted: invitedTenantIds.size }))

  const { data: acceptanceDepartments } = hospitalTenants.length === 2
    ? await db.from("departments").select("tenant_id, name").in("tenant_id", hospitalTenants.map((tenant) => tenant.id)).eq("is_deleted", false)
    : { data: [] }
  const requiredDepartmentNames = ["Laboratory", "Pharmacy", "Billing / Cashier", "Reception / Registration / Medical Records"]
  const isolatedDepartments = hospitalTenants.length === 2 && hospitalTenants.every((tenant) => {
    const names = new Set((acceptanceDepartments ?? []).filter((row: Record<string, unknown>) => row.tenant_id === tenant.id).map((row: Record<string, unknown>) => String(row.name)))
    return requiredDepartmentNames.every((name) => names.has(name))
  })
  steps.push(isolatedDepartments
    ? pass("tenant_isolation", "Tenant isolation", { tenantIds: hospitalTenants.map((tenant) => tenant.id), requiredDepartmentNames })
    : fail("tenant_isolation", "Tenant isolation", "TENANT_SCOPED_DEPARTMENTS_MISSING"))

  const { data: inactiveTenant } = await db.from("tenants").select("id, status, is_active").eq("slug", "ebrine").maybeSingle()
  const inactiveProbe = await probe("ebrine.synapseos.tech")
  steps.push(inactiveTenant && inactiveTenant.is_active !== true && inactiveProbe.status === 404
    ? pass("inactive_tenant_failure", "Inactive tenant failure", { status: inactiveTenant.status, httpStatus: inactiveProbe.status })
    : fail("inactive_tenant_failure", "Inactive tenant failure", "INACTIVE_TENANT_NOT_CLOSED", { tenant: inactiveTenant, probe: inactiveProbe }))

  const reserved = ["admin", "app", "www", "pharm", "api", "status", "docs"]
  const [adminHost, appHost, pharmHost] = await Promise.all([probe("admin.synapseos.tech"), probe("app.synapseos.tech"), probe("pharm.synapseos.tech")])
  const reservedPass = reserved.every((slug) => facilitySlugFromHost(`${slug}.synapseos.tech`) === null) && [adminHost, appHost, pharmHost].every((result) => result.status > 0 && result.status !== 404)
  steps.push(reservedPass
    ? pass("reserved_hosts", "Reserved hosts", { reserved, admin: adminHost.status, app: appHost.status, pharm: pharmHost.status })
    : fail("reserved_hosts", "Reserved hosts", "RESERVED_HOST_ROUTED_AS_TENANT"))

  const spoofed = await probe("domain-test.synapseos.tech", { "x-tenant-id": String(pharmacyTenant?.id ?? "spoof"), "x-tenant-slug": "pharm-synapse-acceptance-pharmacy" })
  steps.push(spoofed.status === known.status && spoofed.location === known.location
    ? pass("spoofed_header_rejection", "Spoofed header rejection", { known, spoofed })
    : fail("spoofed_header_rejection", "Spoofed header rejection", "SPOOF_CHANGED_ROUTE", { known, spoofed }))

  const [{ data: pharmacyFlags }, pharmacyWorkspace] = await Promise.all([
    pharmacyTenant ? db.from("feature_flags").select("feature_key").eq("tenant_id", pharmacyTenant.id).eq("is_enabled", true) : Promise.resolve({ data: [] }),
    probe("pharm.synapseos.tech"),
  ])
  const pharmacyKeys = new Set((pharmacyFlags ?? []).map((row: Record<string, unknown>) => String(row.feature_key)))
  const pharmacyPass = pharmacyTenant?.is_active === true && pharmacyStores?.length === 1 && ["pharmacy_core", "inventory", "pos"].every((key) => pharmacyKeys.has(key)) && pharmacyWorkspace.status === 200
  steps.push(pharmacyPass
    ? pass("pharmacy_workspace", "Pharmacy workspace", { tenantId: pharmacyTenant.id, storeCount: pharmacyStores.length, status: pharmacyWorkspace.status })
    : fail("pharmacy_workspace", "Pharmacy workspace", "PHARMACY_WORKSPACE_INCOMPLETE", { tenant: pharmacyTenant, storeCount: pharmacyStores?.length ?? 0, status: pharmacyWorkspace.status }))

  const [{ data: labFlags }, { data: labAdmins }, labWorkspace] = await Promise.all([
    labTenant ? db.from("feature_flags").select("feature_key").eq("tenant_id", labTenant.id).eq("is_enabled", true) : Promise.resolve({ data: [] }),
    labTenant ? db.from("profiles").select("id, role").eq("tenant_id", labTenant.id).eq("role", "lab_admin") : Promise.resolve({ data: [] }),
    probe("synapse-pilot-lab.synapseos.tech"),
  ])
  const labKeys = (labFlags ?? []).map((row: Record<string, unknown>) => String(row.feature_key)).sort()
  const labPass = labTenant?.is_active === true && JSON.stringify(labKeys) === JSON.stringify(["billing", "core", "lab", "registration", "reports"]) && labAdmins?.length === 1 && labWorkspace.status === 307 && labWorkspace.location?.startsWith("/login")
  steps.push(labPass
    ? pass("laboratory_workspace", "Laboratory workspace", { tenantId: labTenant.id, modules: labKeys, labAdminCount: labAdmins.length, status: labWorkspace.status })
    : fail("laboratory_workspace", "Laboratory workspace", "LABORATORY_WORKSPACE_INCOMPLETE", { tenant: labTenant, modules: labKeys, labAdminCount: labAdmins?.length ?? 0, probe: labWorkspace }))

  const status = steps.every((s) => s.status === "PASS") ? "PASS" : "FAIL"
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
