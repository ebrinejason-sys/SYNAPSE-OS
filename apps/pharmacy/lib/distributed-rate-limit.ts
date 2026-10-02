import { createHmac } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { checkRateLimit as checkInMemory } from "@/lib/rateLimit"

/**
 * Postgres-backed rate limiter (consume_auth_rate_limit, migration 20261002160000).
 * State is shared by every serverless instance. Identifiers (IP, email) are never
 * stored: the bucket key is HMAC-SHA256(pepper, "<scope>|<identifier>").
 * If the DB call fails we fall back to the per-instance in-memory limiter rather
 * than failing open.
 */
export type RateLimitDecision = { allowed: boolean; retryAfter: number }

function pepper(): string {
  return process.env.RATE_LIMIT_PEPPER || process.env.SYNAPSE_JWT_SECRET || "synapse-rate-limit"
}

export function rateLimitBucketKey(scope: string, identifier: string): string {
  return createHmac("sha256", pepper()).update(`${scope}|${identifier.trim().toLowerCase()}`, "utf8").digest("hex")
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const key = rateLimitBucketKey(scope, identifier)
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("consume_auth_rate_limit", {
      p_bucket_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error || !data) throw new Error(error?.code ?? "no_data")
    return { allowed: Boolean(data.allowed), retryAfter: Number(data.retry_after ?? windowSeconds) }
  } catch (err) {
    console.error("[rate-limit] shared limiter unavailable, using in-memory fallback:", err instanceof Error ? err.message : "error")
    const local = checkInMemory(`${scope}:${key}`)
    return { allowed: local.allowed, retryAfter: local.retryAfter ?? windowSeconds }
  }
}

/** All buckets are consumed (so counting is not short-circuited); denied if any is over. */
export async function consumeRateLimits(
  checks: Array<{ scope: string; identifier: string; limit: number; windowSeconds: number }>,
): Promise<RateLimitDecision> {
  const results = await Promise.all(checks.map((c) => consumeRateLimit(c.scope, c.identifier, c.limit, c.windowSeconds)))
  const denied = results.filter((r) => !r.allowed)
  if (!denied.length) return { allowed: true, retryAfter: 0 }
  return { allowed: false, retryAfter: Math.max(...denied.map((r) => r.retryAfter)) }
}

/** Pharmacy self-serve signup: 5 / 15 min per IP and 3 / hour per email. */
export const SIGNUP_LIMITS = {
  ip: { limit: 5, windowSeconds: 15 * 60 },
  email: { limit: 3, windowSeconds: 60 * 60 },
} as const
