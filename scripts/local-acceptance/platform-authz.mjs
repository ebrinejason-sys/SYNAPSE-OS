#!/usr/bin/env node
// Local control-plane authorization matrix: server actions and platform APIs against
// anonymous, tenant, observer and security-admin callers, with DB effects as ground truth.
import { readFileSync } from "node:fs"
import { assertLocalTargets, BASE, EMAILS, ensurePlatformUser, loginAs, platformLogin, Report, Session, sql } from "./lib.mjs"

assertLocalTargets()
const r = new Report("platform-authz")
const TENANT_A = "cd6f9771-2479-4236-b9ba-16985b3ef6d4"
const TENANT_B = "73821071-f2a8-40e0-91c1-7803cbfca9e4"

const manifest = JSON.parse(readFileSync(new URL("../../apps/web/.next/server/server-reference-manifest.json", import.meta.url), "utf8"))
const actionId = (name) => {
  const hit = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && Object.keys(v.workers ?? {}).some((w) => w.includes("platform/users")))
  if (!hit) throw new Error(`server action ${name} not in manifest`)
  return hit[0]
}

async function serverAction(session, name, fields) {
  const body = new FormData()
  // The root reference must follow its fields: the server decodes the multipart stream in order.
  for (const [k, v] of Object.entries(fields)) body.set(`_1_${k}`, v)
  body.set("0", '["$K1"]')
  const res = await fetch(`${BASE}/platform/users`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: session.cookie(), origin: BASE, "next-action": actionId(name), accept: "text/x-component" },
    body,
  })
  return { status: res.status, text: await res.text() }
}

const platformA = ensurePlatformUser({ email: "platform-a.e2e@synapseos.invalid", name: "Restore Target A", createdAt: "2021-01-01T00:00:00Z", mustChangePassword: true })
const platformB = ensurePlatformUser({ email: "platform-b.e2e@synapseos.invalid", name: "Restore Operator B" })
const observerUser = ensurePlatformUser({ email: "platform-observer.e2e@synapseos.invalid", name: "Read Only Observer", profileRole: "platform_observer", platformRole: "READ_ONLY_OBSERVER" })
const securityUser = ensurePlatformUser({ email: "platform-security.e2e@synapseos.invalid", name: "Security Admin", profileRole: "platform_observer", platformRole: "SECURITY_ADMIN" })

const nurseId = sql(`select id from profiles where lower(email)='${EMAILS.nurse}'`)
const victimState = (id) => sql(`select md5(coalesce((select row(p.role, p.tenant_id, p.is_deleted, p.verification_status, p.email_verified_at, p.locked_until, p.department_id)::text from profiles p where p.id='${id}'), '') ||
  coalesce((select string_agg(row(m.platform_role, m.status, m.metadata)::text, ',' order by m.id) from platform_memberships m where m.user_id='${id}'), '') ||
  (select count(*) from synapse_sessions s where s.user_id='${id}')::text)`)
const tenantState = (id) => sql(`select md5(row(t.status, t.is_active, t.lifecycle_status, t.plan)::text) from tenants t where t.id='${id}'`)

const actors = {
  anonymous: new Session("anonymous"),
  hospital_admin: await loginAs("hospital_admin"),
  observer: await platformLogin(observerUser, "observer"),
  security_admin: await platformLogin(securityUser, "security_admin"),
}

const denied = (res) => [401, 403, 404].includes(res.status) || (res.status >= 300 && res.status < 400)

for (const [label, session] of Object.entries(actors)) {
  await loginAs("nurse") // keep a live victim session so revocation is observable
  const before = victimState(nurseId)
  const beforeA = victimState(platformA.id)
  const tenantBefore = tenantState(TENANT_B)

  const mutations = [
    ["suspend", "suspendUserAccount", { user_id: nurseId, reason: "authz probe" }],
    ["archive", "archiveUserAccount", { user_id: nurseId, reason: "authz probe" }],
    ["reactivate", "reactivateUserAccount", { user_id: nurseId }],
    ["activate", "activateUserAccount", { user_id: nurseId }],
    ["remove_membership", "removeFacilityMembership", { user_id: nurseId, tenant_id: TENANT_A }],
    ["suspend_platform_admin", "suspendUserAccount", { user_id: platformA.id, reason: "authz probe" }],
    ["archive_platform_admin", "archiveUserAccount", { user_id: platformA.id, reason: "authz probe" }],
  ]
  if (label !== "security_admin") mutations.push(["revoke_sessions", "revokeUserSessions", { user_id: nurseId }])
  for (const [id, name, fields] of mutations) await serverAction(session, name, fields)
  r.check(`platform.${label}.user_lifecycle_actions.no_effect`, victimState(nurseId) === before, "nurse state changed")
  r.check(`platform.${label}.platform_admin_lifecycle.no_effect`, victimState(platformA.id) === beforeA, "platform admin A changed")

  const apis = [
    ["impersonate", "POST", "/api/platform/impersonate", { targetUserId: nurseId }],
    ["facility_lifecycle", "POST", `/api/platform/facilities/${TENANT_B}/lifecycle`, { action: "suspend", reason: "authz probe", acknowledged: true }],
    ["subscription_activate", "POST", "/api/platform/subscriptions/manual-activate", { tenantId: TENANT_B, planSlug: "os_basic", paymentMethod: "cash", amountPaidUgx: 1 }],
    ["subscription_grant", "POST", "/api/platform/subscription-grants", { subject_type: "tenant", subject_id: TENANT_B, tenant_id: TENANT_B, starts_at: "2026-01-01", ends_at: "2027-01-01", reason: "authz probe" }],
    ["facility_staff_invite", "POST", `/api/platform/facilities/${TENANT_B}/staff`, { email: "probe.e2e@synapseos.invalid", fullName: "Probe", role: "nurse" }],
    ["user_activate", "POST", `/api/platform/users/${nurseId}/activate`, {}],
  ]
  if (label !== "security_admin") apis.push(["security_unlock", "POST", "/api/platform/security/unlock", `profile_id=${nurseId}`])
  for (const [id, method, path, body] of apis) {
    const headers = typeof body === "string" ? { "content-type": "application/x-www-form-urlencoded" } : {}
    const res = await session.call(method, path, body, headers)
    r.check(`platform.${label}.api.${id}.denied`, denied(res), `HTTP ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`)
  }
  r.check(`platform.${label}.tenant_b_unchanged`, tenantState(TENANT_B) === tenantBefore)
  r.check(`platform.${label}.no_probe_invite`, Number(sql(`select count(*) from profiles where lower(email)='probe.e2e@synapseos.invalid'`)) === 0)
}

// Security admin holds user.session.revoke only.
await loginAs("nurse")
const security = actors.security_admin
await serverAction(security, "revokeUserSessions", { user_id: nurseId })
r.check("platform.security_admin.revoke_sessions.allowed", Number(sql(`select count(*) from synapse_sessions where user_id='${nurseId}'`)) === 0)

// Platform Admin B: positive control for the harness plus hard limits.
const operator = await platformLogin(platformB, "platform_admin_b")
await loginAs("nurse")
await serverAction(operator, "revokeUserSessions", { user_id: nurseId })
r.check("platform.admin.revoke_sessions.allowed", Number(sql(`select count(*) from synapse_sessions where user_id='${nurseId}'`)) === 0)
r.expectStatus("platform.admin.impersonate_platform_admin.denied", await operator.call("POST", "/api/platform/impersonate", { targetUserId: platformA.id }), 403)
r.expectStatus("platform.admin.impersonate_control_plane_member.denied", await operator.call("POST", "/api/platform/impersonate", { targetUserId: observerUser.id }), 403)
const beforeSelf = victimState(platformB.id)
await serverAction(operator, "archiveUserAccount", { user_id: platformB.id, reason: "self probe" })
await serverAction(operator, "suspendUserAccount", { user_id: platformB.id, reason: "self probe" })
r.check("platform.admin.self_lifecycle.blocked", victimState(platformB.id).length && Number(sql(`select count(*) from profiles where id='${platformB.id}' and is_deleted`)) === 0 && Number(sql(`select count(*) from platform_memberships where user_id='${platformB.id}' and status <> 'ACTIVE'`)) === 0, beforeSelf)
r.check("audit.self_lifecycle_blocked_row", Number(sql(`select count(*) from audit_log where action='user.self_lifecycle_blocked' and user_id='${platformB.id}' and created_at > now() - interval '5 minutes'`)) >= 1)

process.exit(r.summary() ? 0 : 1)
