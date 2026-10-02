import { createHash, randomBytes } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { pharmacyUrl } from "@/lib/app-url"

/**
 * Single-use, expiring set-password links for staff invites and admin resets.
 * Reuses the existing `password_reset_tokens` table (sha256 token_hash, expires_at,
 * used_at) consumed by /api/auth/reset-password; the raw token only ever lives in
 * the emailed URL.
 */
export const INVITE_LINK_TTL_HOURS = 72
export const ADMIN_RESET_LINK_TTL_HOURS = 24

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function newSetupToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex")
  return { token, tokenHash: hashSetupToken(token) }
}

export async function issuePasswordSetupLink(
  userId: string,
  ttlHours: number,
): Promise<{ url: string; expiresAt: string } | null> {
  const { token, tokenHash } = newSetupToken()
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()
  // Only the newest link is valid.
  await supabaseAdmin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null)
  const { error } = await supabaseAdmin
    .from("password_reset_tokens")
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
  if (error) {
    console.error("[password-setup] token insert failed:", error.code ?? error.message)
    return null
  }
  return { url: pharmacyUrl(`/reset-password/${token}`), expiresAt }
}
