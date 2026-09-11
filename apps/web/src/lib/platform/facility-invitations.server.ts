import { randomUUID } from "crypto"
import { hashPassword } from "@synapse/auth"
import { supabaseAdmin } from "@synapse/db/admin"
import { canBindInviteToTenant } from "../invite-scope"
import { generateInviteToken, hashInviteToken } from "./membership.server"

/**
 * Canonical facility staff invitation model: single-use, cryptographically
 * hashed tokens (the raw secret is never persisted), explicit expiry and
 * revocation, and two distinct, fully transactional acceptance paths:
 *
 *  - acceptFacilityInvitationForExistingUser: the caller must already be
 *    authenticated through the existing session system. Their session
 *    identity's verified email must match the invitation exactly. This path
 *    never creates or changes a password — password recovery stays entirely
 *    in the existing recovery workflow (@/lib/auth/password-reset.server).
 *  - registerFacilityInvitationNewAccount: only reachable when no profile
 *    exists yet for the invited email. Creates the profile with the supplied
 *    password. Never marks onboarding complete and never sets a
 *    professional-credential field — those remain distinct, later steps.
 *
 * Both paths delegate invitation consumption, staff_scope_assignments
 * creation, and audit logging to a single Postgres function
 * (supabase/migrations/20260910130000_facility_invitations_acceptance_tx.sql)
 * so they succeed atomically or leave the invitation in its prior,
 * retry-safe state. The invitation row is locked with SELECT ... FOR UPDATE
 * inside that function, so concurrent redemption attempts serialize on the
 * database rather than racing in application code.
 *
 * IMPORTANT: this module is fully implemented and tested (unit + isolated
 * DB-backed integration tests), but is intentionally NOT wired into any live
 * route yet. The route at apps/web/src/app/api/platform/facilities/[id]/staff/route.ts
 * must keep returning 503 until the acceptance-time migration above is
 * verified applied against the real Supabase project via
 * checkFacilityInvitationSchemaCompatibility, and end-to-end acceptance is
 * run against that live schema in an authorized staging environment.
 */

const LAB_ROLES = new Set([
  "hospital_admin",
  "lab_admin",
  "lab_technician",
  "lab_scientist",
  "billing_officer",
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

export type AcceptFacilityInvitationResult =
  | { ok: true; profileId: string; tenantId: string }
  | { ok: false; status: number; code: string; error: string }

/** Explicit schema compatibility check — never assume the migration has been applied remotely. */
export async function checkFacilityInvitationSchemaCompatibility(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const [tableCheck, auditCheck] = await Promise.all([
    db.from("facility_invitations").select("token_hash, redeemed_by, department_id").limit(1),
    db.from("facility_invitation_audit").select("id").limit(1),
  ])
  return !tableCheck.error && !auditCheck.error
}

const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  INVITE_NOT_FOUND: 404,
  PROFILE_NOT_FOUND: 404,
  INVITE_REVOKED: 410,
  INVITE_EXPIRED: 410,
  INVITE_ALREADY_USED: 409,
  WRONG_RECIPIENT: 403,
  IDENTITY_SCOPE_CONFLICT: 409,
  IDENTITY_EXISTS: 409,
  DEPARTMENT_OUT_OF_SCOPE: 403,
}

/** Maps the Postgres function's RAISE EXCEPTION message to an HTTP-shaped result. */
function rpcErrorToResult(error: { message: string } | null): AcceptFacilityInvitationResult {
  const code = (error?.message ?? "").trim() || "ACCEPT_FAILED"
  const status = CODE_STATUS[code] ?? 500
  return { ok: false, status, code, error: humanizeCode(code) }
}

async function recordAcceptanceFailure(tokenHash: string, code: string, actorProfileId?: string): Promise<void> {
  // The RPC transaction has already rolled back. Keep this surviving record
  // deliberately small: no token, password, or email data is retained.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: invitation } = await db.from("facility_invitations").select("id").eq("token_hash", tokenHash).maybeSingle()
  if (!invitation?.id) return
  await db.from("facility_invitation_audit").insert({
    invitation_id: invitation.id,
    event: "ACCEPT_FAILED",
    actor_profile_id: actorProfileId ?? null,
    metadata: { code },
  })
}

function humanizeCode(code: string): string {
  switch (code) {
    case "INVITE_NOT_FOUND":
      return "Invalid invitation"
    case "PROFILE_NOT_FOUND":
      return "Session profile could not be found"
    case "INVITE_REVOKED":
      return "This invitation was revoked"
    case "INVITE_EXPIRED":
      return "This invitation has expired"
    case "INVITE_ALREADY_USED":
      return "This invitation has already been used"
    case "WRONG_RECIPIENT":
      return "This invitation was addressed to a different account"
    case "IDENTITY_SCOPE_CONFLICT":
      return "This account is already associated with another facility"
    case "IDENTITY_EXISTS":
      return "An account already exists for this email; sign in to accept this invitation"
    case "DEPARTMENT_OUT_OF_SCOPE":
      return "The invited section is no longer part of this facility"
    case "INVALID_INPUT":
      return "Missing required input"
    default:
      return "Failed to accept invitation"
  }
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
      department_id: input.departmentId ?? null,
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

export type FacilityInvitationLookup =
  | { ok: true; email: string; tenantName: string; hasExistingAccount: boolean }
  | { ok: false; status: number; code: string; error: string }

/** Read-only preview so the client can route to the correct acceptance UI (sign-in vs. registration) without redeeming the token. */
export async function lookupFacilityInvitation(token: string): Promise<FacilityInvitationLookup> {
  if (!token) return { ok: false, status: 400, code: "INVALID_INPUT", error: "Missing invitation token" }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(token)
  const { data: invite, error } = await db
    .from("facility_invitations")
    .select("email, status, expires_at, tenant_id, tenants(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (error || !invite) return { ok: false, status: 404, code: "INVITE_NOT_FOUND", error: "Invalid invitation" }
  if (invite.status === "REVOKED") return { ok: false, status: 410, code: "INVITE_REVOKED", error: "This invitation was revoked" }
  if (invite.status === "ACCEPTED") return { ok: false, status: 409, code: "INVITE_ALREADY_USED", error: "This invitation has already been used" }
  if (new Date(invite.expires_at) < new Date()) return { ok: false, status: 410, code: "INVITE_EXPIRED", error: "This invitation has expired" }

  const { data: existingProfile } = await db.from("profiles").select("id").eq("email", invite.email).maybeSingle()
  return {
    ok: true,
    email: invite.email,
    tenantName: invite.tenants?.name ?? "",
    hasExistingAccount: Boolean(existingProfile),
  }
}

/**
 * Existing-user acceptance. `sessionProfileId` must come from the caller's
 * already-validated session (see @synapse/auth/context) — this function does
 * not itself authenticate the caller. It never creates or changes a
 * password; the profile's password is untouched. All consumption, membership
 * assignment, and audit writes happen inside a single database transaction
 * (see accept_facility_invitation_existing_user in the acceptance-tx
 * migration), so a partial failure leaves the invitation retry-safe rather
 * than partially applied.
 */
export async function acceptFacilityInvitationForExistingUser(params: {
  token: string
  sessionProfileId: string
}): Promise<AcceptFacilityInvitationResult> {
  if (!params.token || !params.sessionProfileId) {
    return { ok: false, status: 400, code: "INVALID_INPUT", error: "Missing invitation token or session" }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(params.token)

  const { data, error } = await db.rpc("accept_facility_invitation_existing_user", {
    p_token_hash: tokenHash,
    p_session_profile_id: params.sessionProfileId,
  })

  if (error) {
    const result = rpcErrorToResult(error)
    await recordAcceptanceFailure(tokenHash, result.ok ? "ACCEPT_FAILED" : result.code, params.sessionProfileId)
    return result
  }
  return { ok: true, profileId: data.profile_id, tenantId: data.tenant_id }
}

/**
 * New-account registration. Only succeeds when no profile exists yet for the
 * invited email — an existing identity must use
 * acceptFacilityInvitationForExistingUser instead. The plaintext password is
 * hashed here (never persisted or passed to the database as plaintext), and
 * the entire acceptance (invitation consumption, profile creation,
 * membership assignment, audit) happens inside one database transaction.
 */
export async function registerFacilityInvitationNewAccount(params: {
  token: string
  password: string
}): Promise<AcceptFacilityInvitationResult> {
  if (!params.token) return { ok: false, status: 400, code: "INVALID_INPUT", error: "Missing invitation token" }
  if (!params.password || params.password.length < 8) {
    return { ok: false, status: 400, code: "INVALID_INPUT", error: "Password must be at least 8 characters" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = hashInviteToken(params.token)

  const { data: invite } = await db.from("facility_invitations").select("full_name").eq("token_hash", tokenHash).maybeSingle()
  const nameParts = String(invite?.full_name ?? "").split(/\s+/).filter(Boolean)
  const passwordHash = await hashPassword(params.password)
  const profileId = randomUUID()

  const { data, error } = await db.rpc("accept_facility_invitation_new_account", {
    p_token_hash: tokenHash,
    p_profile_id: profileId,
    p_password_hash: passwordHash,
    p_full_name: invite?.full_name ?? null,
    p_first_name: nameParts[0] ?? invite?.full_name ?? null,
    p_last_name: nameParts.slice(1).join(" ") || null,
  })

  if (error) {
    const result = rpcErrorToResult(error)
    await recordAcceptanceFailure(tokenHash, result.ok ? "ACCEPT_FAILED" : result.code)
    return result
  }
  return { ok: true, profileId: data.profile_id, tenantId: data.tenant_id }
}
