import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { supabaseAdmin } from "@synapse/db/admin"
import { hasDb } from "./test-db-guard"
import {
  acceptFacilityInvitationForExistingUser,
  createFacilityInvitation,
  registerFacilityInvitationNewAccount,
} from "./facility-invitations.server"

/**
 * Isolated, database-backed acceptance tests. Skips cleanly when
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured (see
 * hasDb). These exercise the real Postgres transaction, unique constraints,
 * and row-lock concurrency behavior of
 * supabase/migrations/20260910130000_facility_invitations_acceptance_tx.sql —
 * guarantees the mock-only unit test in facility-invitations.server.test.ts
 * cannot prove.
 */
describe.skipIf(!hasDb)("facility invitation acceptance (isolated DB)", { timeout: 30_000 }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let tenantId: string
  let otherTenantId: string
  let departmentId: string
  const createdProfileIds: string[] = []

  beforeEach(async () => {
    tenantId = crypto.randomUUID()
    otherTenantId = crypto.randomUUID()
    departmentId = crypto.randomUUID()
    createdProfileIds.length = 0

    for (const [id, name] of [
      [tenantId, "Isolated Test Lab"],
      [otherTenantId, "Isolated Test Lab (Other)"],
    ]) {
      const { error } = await db.from("tenants").insert({
        id,
        slug: id,
        name,
        facility_type: "laboratory",
        is_synthetic: true,
        environment: "demo",
        data_classification: "synthetic",
      })
      if (error) throw new Error(error.message)
    }

    const { error: deptError } = await db.from("departments").insert({ id: departmentId, tenant_id: tenantId, name: "Microbiology" })
    if (deptError) throw new Error(deptError.message)
  })

  afterEach(async () => {
    await db.from("staff_scope_assignments").delete().in("tenant_id", [tenantId, otherTenantId])
    const { data: invites } = await db.from("facility_invitations").select("id").in("tenant_id", [tenantId, otherTenantId])
    const inviteIds = (invites ?? []).map((r: { id: string }) => r.id)
    if (inviteIds.length) {
      await db.from("facility_invitation_audit").delete().in("invitation_id", inviteIds)
      await db.from("facility_invitations").delete().in("id", inviteIds)
    }
    if (createdProfileIds.length) await db.from("profiles").delete().in("id", createdProfileIds)
    await db.from("departments").delete().eq("id", departmentId)
    await db.from("tenants").delete().in("id", [tenantId, otherTenantId])
  })

  it("registers a new account, persists the invited department, and never marks onboarding complete or professional verification", async () => {
    const email = `new-${crypto.randomUUID()}@isolated.test`
    const created = await createFacilityInvitation({ tenantId, email, fullName: "New Person", role: "lab_tech", departmentId, actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const { data: storedInvite } = await db.from("facility_invitations").select("role").eq("id", created.invitationId).single()
    expect(storedInvite.role).toBe("lab_technician")

    const result = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    createdProfileIds.push(result.profileId)

    const { data: profile } = await db.from("profiles").select("role, onboarding_complete, verification_status, password_hash").eq("id", result.profileId).single()
    expect(profile.role).toBe("lab_technician")
    expect(profile.onboarding_complete).toBe(false)
    expect(profile.password_hash).toBeTruthy()
    expect(profile.verification_status).toBe("pending")

    const { data: scopes } = await db.from("staff_scope_assignments").select("department_id, tenant_id, is_active").eq("profile_id", result.profileId)
    expect(scopes).toHaveLength(1)
    expect(scopes[0].department_id).toBe(departmentId)
    expect(scopes[0].is_active).toBe(true)

    const { data: invite } = await db.from("facility_invitations").select("status, redeemed_by").eq("id", created.invitationId).single()
    expect(invite.status).toBe("ACCEPTED")
    expect(invite.redeemed_by).toBe(result.profileId)
  })

  it("rejects the wrong authenticated recipient and leaves the invitation acceptable by retry", async () => {
    const invitedEmail = `victim-${crypto.randomUUID()}@isolated.test`
    const wrongProfileId = crypto.randomUUID()
    const { error: wrongProfileErr } = await db.from("profiles").insert({
      id: wrongProfileId,
      email: `attacker-${crypto.randomUUID()}@isolated.test`,
      full_name: "Wrong Person",
      role: "lab_technician",
      tenant_id: null,
      verification_status: "verified",
    })
    if (wrongProfileErr) throw new Error(wrongProfileErr.message)
    createdProfileIds.push(wrongProfileId)

    const created = await createFacilityInvitation({ tenantId, email: invitedEmail, fullName: "Victim Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const wrongResult = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: wrongProfileId })
    expect(wrongResult.ok).toBe(false)
    if (!wrongResult.ok) expect(wrongResult.code).toBe("WRONG_RECIPIENT")

    const { data: invite } = await db.from("facility_invitations").select("status").eq("id", created.invitationId).single()
    expect(invite.status).toBe("PENDING")

    // Retry with the correct recipient must still succeed — the failed
    // attempt above must not have left the invitation stuck.
    const correctProfileId = crypto.randomUUID()
    const { error: correctProfileErr } = await db.from("profiles").insert({
      id: correctProfileId,
      email: invitedEmail,
      full_name: "Victim Person",
      role: "lab_technician",
      tenant_id: null,
      verification_status: "verified",
    })
    if (correctProfileErr) throw new Error(correctProfileErr.message)
    createdProfileIds.push(correctProfileId)

    const retry = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: correctProfileId })
    expect(retry.ok).toBe(true)
  })

  it("never overwrites an existing password on existing-user acceptance", async () => {
    const email = `member-${crypto.randomUUID()}@isolated.test`
    const profileId = crypto.randomUUID()
    const { error: profileErr } = await db.from("profiles").insert({
      id: profileId,
      email,
      full_name: "Member Person",
      role: "lab_technician",
      tenant_id: null,
      password_hash: "original-hash-should-not-change",
      verification_status: "verified",
    })
    if (profileErr) throw new Error(profileErr.message)
    createdProfileIds.push(profileId)

    const created = await createFacilityInvitation({ tenantId, email, fullName: "Member Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: profileId })
    expect(result.ok).toBe(true)

    const { data: profile } = await db.from("profiles").select("password_hash").eq("id", profileId).single()
    expect(profile.password_hash).toBe("original-hash-should-not-change")
  })

  it("supports multi-facility membership: accepting a second facility's invitation does not remove the first", async () => {
    const email = `multi-${crypto.randomUUID()}@isolated.test`
    const profileId = crypto.randomUUID()
    const { error: profileErr } = await db.from("profiles").insert({
      id: profileId,
      email,
      full_name: "Multi Facility Person",
      role: "lab_technician",
      tenant_id: null,
      verification_status: "verified",
    })
    if (profileErr) throw new Error(profileErr.message)
    createdProfileIds.push(profileId)

    const { error: firstScopeErr } = await db.from("staff_scope_assignments").insert({ profile_id: profileId, tenant_id: tenantId, role: "lab_technician", is_active: true })
    if (firstScopeErr) throw new Error(firstScopeErr.message)

    const created = await createFacilityInvitation({ tenantId: otherTenantId, email, fullName: "Multi Facility Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: profileId })
    expect(result.ok).toBe(true)

    const { data: scopes } = await db.from("staff_scope_assignments").select("tenant_id, is_active").eq("profile_id", profileId).eq("is_active", true)
    const tenantIds = (scopes ?? []).map((s: { tenant_id: string }) => s.tenant_id).sort()
    expect(tenantIds).toEqual([tenantId, otherTenantId].sort())
  })

  it("rejects an expired invitation and rejects a revoked invitation", async () => {
    const expiredEmail = `expired-${crypto.randomUUID()}@isolated.test`
    const expiredCreated = await createFacilityInvitation({ tenantId, email: expiredEmail, fullName: "Expired Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(expiredCreated.ok).toBe(true)
    if (!expiredCreated.ok) return
    await db.from("facility_invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", expiredCreated.invitationId)

    const expiredResult = await registerFacilityInvitationNewAccount({ token: expiredCreated.token, password: "supersecret1" })
    expect(expiredResult.ok).toBe(false)
    if (!expiredResult.ok) expect(expiredResult.code).toBe("INVITE_EXPIRED")

    const revokedEmail = `revoked-${crypto.randomUUID()}@isolated.test`
    const revokedCreated = await createFacilityInvitation({ tenantId, email: revokedEmail, fullName: "Revoked Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(revokedCreated.ok).toBe(true)
    if (!revokedCreated.ok) return
    await db.from("facility_invitations").update({ status: "REVOKED" }).eq("id", revokedCreated.invitationId)

    const revokedResult = await registerFacilityInvitationNewAccount({ token: revokedCreated.token, password: "supersecret1" })
    expect(revokedResult.ok).toBe(false)
    if (!revokedResult.ok) expect(revokedResult.code).toBe("INVITE_REVOKED")
  })

  it("serializes concurrent redemption of the same invitation: exactly one winner, one profile, one membership row", async () => {
    const email = `concurrent-${crypto.randomUUID()}@isolated.test`
    const created = await createFacilityInvitation({ tenantId, email, fullName: "Concurrent Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })),
    )
    const winners = attempts.filter((r) => r.ok)
    const losers = attempts.filter((r) => !r.ok)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(4)
    for (const loser of losers) {
      if (!loser.ok) expect(["INVITE_ALREADY_USED", "IDENTITY_EXISTS"]).toContain(loser.code)
    }

    const winnerProfileId = (winners[0] as { ok: true; profileId: string }).profileId
    createdProfileIds.push(winnerProfileId)

    const { data: profiles } = await db.from("profiles").select("id").eq("email", email)
    expect(profiles).toHaveLength(1)

    const { data: scopes } = await db.from("staff_scope_assignments").select("id").eq("profile_id", winnerProfileId)
    expect(scopes).toHaveLength(1)
  })

  it("rejects registration when an account already exists, directing the caller to the existing-user path instead of silently failing", async () => {
    const email = `already-${crypto.randomUUID()}@isolated.test`
    const existingProfileId = crypto.randomUUID()
    const { error: profileErr } = await db.from("profiles").insert({
      id: existingProfileId,
      email,
      full_name: "Already Person",
      role: "lab_technician",
      tenant_id: null,
      verification_status: "verified",
    })
    if (profileErr) throw new Error(profileErr.message)
    createdProfileIds.push(existingProfileId)

    const created = await createFacilityInvitation({ tenantId, email, fullName: "Already Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("IDENTITY_EXISTS")

    const { data: invite } = await db.from("facility_invitations").select("status").eq("id", created.invitationId).single()
    expect(invite.status).toBe("PENDING")
  })

  it("rejects an invalid token and a second redemption of an already-accepted invitation", async () => {
    const invalid = await registerFacilityInvitationNewAccount({ token: "not-a-real-invite-token", password: "supersecret1" })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe("INVITE_NOT_FOUND")

    const email = `dup-${crypto.randomUUID()}@isolated.test`
    const created = await createFacilityInvitation({ tenantId, email, fullName: "Dup Person", role: "lab_tech", actorId: crypto.randomUUID() })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const first = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(first.ok).toBe(true)
    if (first.ok) createdProfileIds.push(first.profileId)

    const second = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(["INVITE_ALREADY_USED", "IDENTITY_EXISTS"]).toContain(second.code)
  })

  it("rejects an unsupported invitation role instead of persisting an alias that cannot be redeemed", async () => {
    const created = await createFacilityInvitation({
      tenantId,
      email: `bad-role-${crypto.randomUUID()}@isolated.test`,
      fullName: "Bad Role Person",
      role: "lab_supervisor",
      actorId: crypto.randomUUID(),
    })
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.code).toBe("INVALID_INPUT")
    const { data: invites } = await db.from("facility_invitations").select("id").eq("tenant_id", tenantId)
    expect(invites ?? []).toHaveLength(0)
  })
})
