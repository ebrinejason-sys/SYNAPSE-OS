import { createHash, randomBytes, timingSafeEqual } from "crypto"

/**
 * Facility invitation secrets (provisioned pharmacy/hospital admin invites).
 *
 * - The raw token is 32 crypto-random bytes (hex) and is only ever held in memory
 *   long enough to build the emailed link.
 * - Only `token_hash` (SHA-256 hex) is persisted. A leaked DB row cannot be replayed
 *   as an invite link: presenting the stored hash hashes it again and matches nothing.
 * - Comparison of the presented token's hash with the stored hash is constant-time.
 * - Expiry and single use are enforced by callers via `status`/`expires_at` and an
 *   atomic conditional claim (status IN (PENDING, SENT) AND expires_at > now()).
 *
 * Rows created before migration 20261002150000 stored the plaintext in
 * `invite_token`; that migration backfills `token_hash` and nulls the plaintext.
 * The legacy branch below only exists so an app deployed before the migration
 * keeps honouring live invitations; after the backfill it matches nothing.
 */
export const FACILITY_INVITE_TOKEN_BYTES = 32

export function generateFacilityInviteToken(): string {
  return randomBytes(FACILITY_INVITE_TOKEN_BYTES).toString("hex")
}

export function hashFacilityInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function facilityInviteTokenMatches(token: string, storedHash: string | null | undefined): boolean {
  if (!token || !storedHash) return false
  return safeEqualHex(hashFacilityInviteToken(token), storedHash)
}

/** Reject obviously malformed input before touching the DB. */
export function isPlausibleFacilityInviteToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 32 && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token)
}

export type FacilityInviteLookup<T> = { invite: T; storage: "token_hash" | "invite_token" } | null

/**
 * Find a facility invitation by its presented raw token. `columns` must not
 * include token_hash / invite_token (they are added and stripped here).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findFacilityInvitationByToken<T = Record<string, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  token: string,
  columns: string,
): Promise<FacilityInviteLookup<T>> {
  if (!isPlausibleFacilityInviteToken(token)) return null
  const tokenHash = hashFacilityInviteToken(token)
  const hashed = await db
    .from("facility_invitations")
    .select(`${columns}, token_hash`)
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (hashed?.data && facilityInviteTokenMatches(token, hashed.data.token_hash)) {
    const { token_hash: _h, invite_token: _p, ...invite } = hashed.data
    return { invite: invite as T, storage: "token_hash" }
  }
  const legacy = await db
    .from("facility_invitations")
    .select(`${columns}, invite_token, token_hash`)
    .eq("invite_token", token)
    .maybeSingle()
  if (legacy?.data?.invite_token && !legacy.data.token_hash && safeEqualHex(String(legacy.data.invite_token), token)) {
    const { invite_token: _t, token_hash: _h2, ...invite } = legacy.data
    return { invite: invite as T, storage: "invite_token" }
  }
  return null
}

/**
 * Issue a fresh secret for an existing, still-open invitation (resume / resend).
 * The previous link stops working because its hash is replaced.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rotateFacilityInviteToken(db: any, invitationId: string): Promise<string | null> {
  const token = generateFacilityInviteToken()
  const { data, error } = await db
    .from("facility_invitations")
    .update({ token_hash: hashFacilityInviteToken(token), invite_token: null, updated_at: new Date().toISOString() })
    .eq("id", invitationId)
    .in("status", ["PENDING", "SENT"])
    .select("id")
    .maybeSingle()
  if (error || !data) return null
  return token
}
