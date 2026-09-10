import { randomUUID } from "crypto"
import { hashPassword } from "@synapse/auth"
import { supabaseAdmin } from "@synapse/db/admin"
import { canBindInviteToTenant } from "../invite-scope"
import { generateInviteToken, hashInviteToken } from "./membership.server"

/**
 * Canonical facility staff invitation model: single-use, cryptographically
 * hashed tokens (the raw secret is never persisted), explicit expiry and
 * revocation, retry-safe redemption via a conditional status transition, and
 * identity resolution that binds to the existing staff_scope_assignments
 * model instead of overwriting a profile's existing facility association.
 *
 * IMPORTANT: this module is fully implemented and unit-tested in isolation,
 * but is intentionally NOT wired into any live route yet. The route at
 * apps/web/src/app/api/platform/facilities/[id]/staff/route.ts must keep
 * returning 503 until: (1) the token_hash/redeemed_by migration
 * (20260910120000_facility_invitations_token_hash.sql) is verified applied
 * against the real Supabase project via checkFacilityInvitationSchemaCompatibility,
 * and (2) end-to-end acceptance tests run against that live schema.
 */

const LAB_ROLES = new Set([
  "hospital_admin",
  "facility_admin",
  "lab_tech",
  "lab_scientist",
  "billing_officer",
  "quality_officer",
  "instrument_manager",
])

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type CreateFacilityInvitationInput = {
  tenantId: string
  email: string
  fullName: string
  role: string
  departmentId?: string | null
  actorId: string
}

export type CreateFacilityInvitationResult =
  | { ok: true; invitationId: string; token: string; expiresAt: string; email: string; tenantName: string }
  | { ok: false; status: number; code: string; error: string }

export type RedeemFacilityInvitationResult =
  | { ok: true; profileId: string; tenantId: string }
  | { ok: false; status: number; code: string; error: string }

/** Explicit schema compatibility check — never assume the migration has been applied remotely. */
export async function checkFacilityInvitationSchemaCompatibility(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { error } = await db.from("facility_invitations").select("token_hash, redeemed_by").limit(1)
  return !error
}

export async function createFacilityInvitation(input: CreateFacilityInvitationInput): Promise<CreateFacilityInvitationResult> {
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  const role = input.role.trim()
  if (!email || !fullName || !LAB_ROLES.has(role)) {
    return { ok: false, status: 400, code: "INVALID_INPUT", error: "fullName, email and a valid laboratory role are required" }
  }

  if (!(await checkFacilityInvitationSchemaCompatibility())) {
    return { ok: false, status: 503, code: "SCHEMA_INCOMPATIBLE", error: "facility_invitations is missing the token_hash/redeemed_by columns required by the hardened invitation flow" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: tenant } = await db.from("tenants").select("id, name, facility_type").eq("id", input.tenantId).eq("facility_type", "laboratory").maybeSingle()
  if (!tenant) return { ok: false, status: 404, code: "FACILITY_NOT_FOUND", error: "Laboratory facility not found" }

  if (input.departmentId) {
    const { data: department } = await db.from("departments").select("id").eq("id", input.departmentId).eq("tenant_id", input.tenantId).maybeSingle()
    if (!department) return { ok: false, status: 403, code: "DEPARTMENT_OUT_OF_SCOPE", error: "Section is outside this laboratory" }
  }

  // Resolve existing identity without overwriting another facility's scope.
  const { data: existingProfile } = await db.from("profiles").select("id, tenant_id").eq("email", email).maybeSingle()
  if (existingProfile) {
    const { data: activeScopes } = await db.from("staff_scope_assignments").select("tenant_id").eq("profile_id", existingProfile.id).eq("is_active", true)
    const activeTenantIds = ((activeScopes ?? []) as Array<{ tenant_id: string | null }>).map((s) => s.tenant_id)
    if (!canBindInviteToTenant(existingProfile.tenant_id, activeTenantIds, input.tenantId)) {
      return { ok: false, status: 409, code: "IDENTITY_SCOPE_CONFLICT", error: "This account is already associated with another facility" }
    }
  }

  const { data: pendingInvite } = await db
    .from("facility_invitations")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("email", email)
    .in("status", ["PENDING", "SENT"])
    .maybeSingle()
  if (pendingInvite) return { ok: false, status: 409, code: "INVITE_ALREADY_PENDING", error: "An active invitation already exists for this email" }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { data: invitation, error } = await db
    .from("facility_invitations")
    .insert({
      tenant_id: input.tenantId,
      email,
      full_name: fullName,
      role,
      token_hash: tokenHash,
      invite_token: null,
      status: "PENDING",
      expires_at: expiresAt,
      created_by: input.actorId,
      profile_id: existingProfile?.id ?? null,
    })
    .select("id, status, expires_at")
    .single()

  if (error || !invitation) return { ok: false, status: 500, code: "INVITE_CREATE_FAILED", error: error?.message ?? "Failed to create invitation" }

  return { ok: true, invitationId: invitation.id, token, expiresAt, email, tenantName: tenant.name }
}

/** Best-effort delivery — failure is recoverable and recorded, never fatal to invitation creation. */
export async function markFacilityInvitationDeliveryFailed(invitationId: string, reason: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from("facility_invitations").update({ last_error: reason, updated_at: new Date().toISOString() }).eq("id", invitationId)
}

export async function markFacilityInvitationSent(invitationId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from("facility_invitations").update({ status: "SENT", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invitationId)
}

export async function redeemFacilityInvitation(token: string, password: string): Promise<RedeemFacilityInvitationResult> {
  if (!token) return { ok: false, status: 400, code: "INVALID_INPUT", error: "Missing invitation token" }
  if (password.length < 8) return { ok: false, status: 400, code: "INVALID_INPUT", error: "Password must be at least 8 characters" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(token)
  const { data: invite } = await db.from("facility_invitations").select("*").eq("token_hash", tokenHash).maybeSingle()
  if (!invite) return { ok: false, status: 404, code: "INVITE_NOT_FOUND", error: "Invalid invitation" }
  if (invite.status === "REVOKED") return { ok: false, status: 410, code: "INVITE_REVOKED", error: "This invitation was revoked" }
  if (invite.status === "ACCEPTED") return { ok: false, status: 409, code: "INVITE_ALREADY_USED", error: "This invitation has already been used" }
  if (new Date(invite.expires_at) < new Date()) {
    await db.from("facility_invitations").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", invite.id)
    return { ok: false, status: 410, code: "INVITE_EXPIRED", error: "This invitation has expired" }
  }

  // Single-use, retry-safe: only the caller that wins this conditional update
  // may proceed. A concurrent or replayed redemption sees zero rows affected
  // and is told the invitation was already used rather than double-applying.
  const { data: claimed, error: claimErr } = await db
    .from("facility_invitations")
    .update({ status: "ACCEPTED", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", invite.id)
    .in("status", ["PENDING", "SENT"])
    .select("id")
    .maybeSingle()
  if (claimErr) return { ok: false, status: 500, code: "INVITE_CLAIM_FAILED", error: claimErr.message }
  if (!claimed) return { ok: false, status: 409, code: "INVITE_ALREADY_USED", error: "This invitation has already been used" }

  const passwordHash = await hashPassword(password)
  let profileId: string
  const { data: existingProfile } = await db.from("profiles").select("id, tenant_id").eq("email", invite.email).maybeSingle()

  if (existingProfile) {
    const { data: activeScopes } = await db.from("staff_scope_assignments").select("tenant_id").eq("profile_id", existingProfile.id).eq("is_active", true)
    const activeTenantIds = ((activeScopes ?? []) as Array<{ tenant_id: string | null }>).map((s) => s.tenant_id)
    if (!canBindInviteToTenant(existingProfile.tenant_id, activeTenantIds, invite.tenant_id)) {
      await db.from("facility_invitations").update({ status: "FAILED", last_error: "identity already scoped to another facility", updated_at: new Date().toISOString() }).eq("id", invite.id)
      return { ok: false, status: 409, code: "IDENTITY_SCOPE_CONFLICT", error: "This account is already associated with another facility" }
    }
    profileId = existingProfile.id
    await db.from("profiles").update({ password_hash: passwordHash, must_change_password: false, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", profileId)
  } else {
    profileId = randomUUID()
    const nameParts = String(invite.full_name ?? "").split(/\s+/)
    const { error: createErr } = await db.from("profiles").insert({
      id: profileId,
      email: invite.email,
      full_name: invite.full_name,
      first_name: nameParts[0] ?? invite.full_name,
      last_name: nameParts.slice(1).join(" ") || null,
      role: invite.role,
      tenant_id: invite.tenant_id,
      hospital_id: invite.tenant_id,
      password_hash: passwordHash,
      must_change_password: false,
      onboarding_complete: true,
      verification_status: "verified",
      created_by: invite.created_by,
    })
    if (createErr) {
      await db.from("facility_invitations").update({ status: "FAILED", last_error: createErr.message, updated_at: new Date().toISOString() }).eq("id", invite.id)
      return { ok: false, status: 500, code: "PROFILE_CREATE_FAILED", error: createErr.message }
    }
  }

  const { data: existingScope } = await db.from("staff_scope_assignments").select("id").eq("profile_id", profileId).eq("tenant_id", invite.tenant_id).eq("is_active", true).maybeSingle()
  if (!existingScope) {
    const { error: scopeErr } = await db.from("staff_scope_assignments").insert({ profile_id: profileId, tenant_id: invite.tenant_id, role: invite.role, is_active: true })
    if (scopeErr) {
      await db.from("facility_invitations").update({ status: "FAILED", last_error: scopeErr.message, updated_at: new Date().toISOString() }).eq("id", invite.id)
      return { ok: false, status: 500, code: "SCOPE_CREATE_FAILED", error: scopeErr.message }
    }
  }

  await db.from("facility_invitations").update({ profile_id: profileId, redeemed_by: profileId, updated_at: new Date().toISOString() }).eq("id", invite.id)

  return { ok: true, profileId, tenantId: invite.tenant_id }
}
