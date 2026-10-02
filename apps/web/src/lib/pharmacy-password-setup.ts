import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'

/**
 * Pharmacy set-password links issued from the web/mobile API (mirror of
 * apps/pharmacy/lib/password-setup.ts). Single-use, expiring rows in
 * `password_reset_tokens` (sha256 token_hash only), consumed by the Pharmacy app at
 * /reset-password/<token>. A password is NEVER generated for handover or returned.
 */
export const PHARMACY_INVITE_LINK_TTL_HOURS = 72
export const PHARMACY_RESET_LINK_TTL_HOURS = 24

export function pharmacyAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_PHARMACY_APP_URL || 'https://pharm.synapseos.tech').replace(/\/$/, '')
}

export function unusablePasswordSeed(): string {
  // Random secret nobody knows — the account is only usable after the link is redeemed.
  return randomBytes(32).toString('base64url')
}

export async function issuePharmacyPasswordSetupLink(
  userId: string,
  ttlHours: number,
): Promise<{ url: string; expiresAt: string } | null> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null)
  const { error } = await db.from('password_reset_tokens').insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
  if (error) {
    console.error('[pharmacy-password-setup] token insert failed:', error.code ?? 'error')
    return null
  }
  return { url: `${pharmacyAppBaseUrl()}/reset-password/${token}`, expiresAt }
}
