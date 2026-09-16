#!/usr/bin/env npx tsx
/**
 * Disposable-local, service-role Hospital / Lab / Pharmacy provisioning smoke.
 *
 * Requires SYNAPSE_DISPOSABLE_DB_TEST=true, explicit loopback SUPABASE_URL,
 * and an explicit disposable SUPABASE_SERVICE_ROLE_KEY. Never targets pilot.
 *
 * Direct database fixture activation bypasses the application. This is NOT
 * authentication, invite-redemption API, RLS, or cross-tenant isolation proof.
 * Destroy the entire disposable stack after use, including on failure.
 */
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { disposableOnboardingTarget } from "./disposable-onboarding-target.mjs"
import { hashPassword } from "@synapse/auth/password"
import { provisionFacility } from "@synapse/db/facility-provision"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const { url, key } = disposableOnboardingTarget(process.env, process.argv.slice(2))
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const password = randomBytes(32).toString('base64url')
const log: string[] = []
const step = (name: string, ok: boolean, extra: Record<string, unknown> = {}) => {
  const line = `${ok ? "PASS" : "FAIL"} ${name}`
  log.push(line)
  console.log(line, extra)
  return ok
}

async function activateRawInvite(token: string) {
  const { data: invite, error } = await db
    .from("facility_invitations")
    .select("id, email, status, expires_at, tenant_id, profile_id, role, invite_token, token_hash")
    .eq("invite_token", token)
    .maybeSingle()
  if (error || !invite) return { ok: false, error: error?.message ?? "INVITE_NOT_FOUND" }
  if (invite.token_hash) return { ok: false, error: "HASHED_TOKEN_NOT_PROVISION_PATH" }
  if (!invite.profile_id) return { ok: false, error: "PROFILE_NOT_FOUND" }
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  const { error: profileErr } = await db
    .from("profiles")
    .update({
      tenant_id: invite.tenant_id,
      password_hash: passwordHash,
      must_change_password: false,
      password_changed_at: now,
      email_verified_at: now,
      onboarding_complete: true,
      updated_at: now,
    })
    .eq("id", invite.profile_id)
  if (profileErr) return { ok: false, error: profileErr.message }
  const { error: scopeErr } = await db.from("staff_scope_assignments").insert({
    profile_id: invite.profile_id,
    tenant_id: invite.tenant_id,
    role: invite.role,
    is_active: true,
  })
  if (scopeErr) return { ok: false, error: scopeErr.message }
  const { error: inviteErr } = await db
    .from("facility_invitations")
    .update({ status: "ACCEPTED", accepted_at: now, redeemed_by: invite.profile_id, updated_at: now })
    .eq("id", invite.id)
  if (inviteErr) return { ok: false, error: inviteErr.message }
  return { ok: true, profileId: invite.profile_id as string, tenantId: invite.tenant_id as string, role: invite.role as string }
}

const specs = [
  { facilityType: "hospital" as const, name: "Hospital A Continuity", slug: `syn-cont-hosp-${stamp.slice(0, 19).toLowerCase()}`, email: `hosp-a-${stamp}@example.invalid`, expectRole: "hospital_admin" },
  { facilityType: "laboratory" as const, name: "Lab B Continuity", slug: `syn-cont-lab-${stamp.slice(0, 19).toLowerCase()}`, email: `lab-b-${stamp}@example.invalid`, expectRole: "lab_admin" },
  { facilityType: "pharmacy" as const, name: "Pharmacy C Continuity", slug: `syn-cont-pharm-${stamp.slice(0, 19).toLowerCase()}`, email: `pharm-c-${stamp}@example.invalid`, expectRole: "pharmacy_admin" },
]

const created: Array<{ tenantId: string; profileId: string; slug: string; role: string }> = []

try {
  const { data: admin } = await db
    .from("profiles")
    .select("id, role, email")
    .in("role", ["platform_admin", "super_admin"])
    .limit(1)
    .maybeSingle()
  if (!admin?.id) throw new Error("No platform admin profile found to use as createdBy")
  step("platform_admin", true, { id: admin.id, role: admin.role })

  for (const spec of specs) {
    const result = await provisionFacility(db, {
      facilityType: spec.facilityType,
      facilityName: spec.name,
      slug: spec.slug,
      adminName: `Synthetic ${spec.facilityType} admin`,
      adminEmail: spec.email,
      createdBy: admin.id,
      mode: "SYNTHETIC_ACCEPTANCE",
      ownership: "PUBLIC",
      sendInvite: false,
    })
    const provisioned = step(`provision_${spec.facilityType}`, result.ok === true, {
      slug: result.slug,
      tenantId: result.tenantId,
      error: result.error ?? null,
    })
    if (!provisioned || !result.tenantId || !result.inviteToken) continue

    const activated = await activateRawInvite(result.inviteToken)
    step(`activate_${spec.facilityType}`, activated.ok === true && activated.role === spec.expectRole, activated)

    if (activated.ok && activated.profileId) {
      const { data: profile } = await db
        .from("profiles")
        .select("id, tenant_id, role, onboarding_complete, password_hash")
        .eq("id", activated.profileId)
        .maybeSingle()
      step(`workspace_${spec.facilityType}`, profile?.tenant_id === result.tenantId && Boolean(profile?.password_hash), {
        tenant_id: profile?.tenant_id,
        role: profile?.role,
      })
      created.push({
        tenantId: result.tenantId,
        profileId: activated.profileId,
        slug: result.slug,
        role: activated.role,
      })
    }
  }

  if (created.length === 3) {
    const [hospital, lab, pharmacy] = created
    const { data: leak, error: lookupError } = await db
      .from("profiles")
      .select("id")
      .eq("id", hospital.profileId)
      .eq("tenant_id", lab.tenantId)
      .maybeSingle()
    step("service_role_filtered_profile_lookup_only", !lookupError && !leak, { hospital: hospital.slug, lab: lab.slug, pharmacy: pharmacy.slug })
    const tenantIds = new Set(created.map((row) => row.tenantId))
    step("three_distinct_tenants", tenantIds.size === 3)
  } else {
    step("three_facilities_activated", false, { count: created.length })
  }
} catch (error) {
  step("live_onboarding_exception", false, { error: error instanceof Error ? error.message : String(error) })
} finally {
  for (const row of created) {
    for (const [table, column, id] of [
      ['staff_scope_assignments', 'profile_id', row.profileId],
      ['facility_invitations', 'tenant_id', row.tenantId],
      ['profiles', 'id', row.profileId],
      ['tenants', 'id', row.tenantId],
    ]) {
      const { error } = await db.from(table).delete().eq(column, id)
      step(`cleanup_${table}`, !error)
    }
  }
  console.log('Dispose of the entire local stack: failed provisioning and provisioning-run records may remain.')
}

const failed = log.filter((line) => line.startsWith("FAIL")).length
const evidenceDir = resolve(root, "docs/engineering/evidence")
mkdirSync(evidenceDir, { recursive: true })
const body = [
  "---",
  `result: ${failed ? "FAIL" : "PASS"}`,
  "environment: disposable-local",
  "proofKind: service-role-smoke",
  `sha: ${execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()}`,
  "scope: facility-provisioning-fixtures-only",
  `recordedAt: ${new Date().toISOString()}`,
  "---",
  "",
  "# Disposable onboarding fixtures (NOT application auth or RLS proof)",
  "",
  `- Disposable endpoint: ${url}`,
  `- When: ${new Date().toISOString()}`,
  "",
  ...log.map((line) => `- ${line}`),
  "",
].join("\n")
writeFileSync(resolve(evidenceDir, `facility-onboarding-live-${stamp}.md`), body)
console.log(`\nSUMMARY fail=${failed} total=${log.length}`)
process.exit(failed ? 1 : 0)
