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

/** Lockout check without counting (auth_rate_limit_status). Falls back to "allowed". */
export async function rateLimitStatus(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("auth_rate_limit_status", {
      p_bucket_key: rateLimitBucketKey(scope, identifier),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error || !data) throw new Error(error?.code ?? "no_data")
    return { allowed: Boolean(data.allowed), retryAfter: Number(data.retry_after ?? 0) }
  } catch {
    const local = memoryFailures.get(`${scope}:${rateLimitBucketKey(scope, identifier)}`)
    if (local && local.hits >= limit && Date.now() - local.start < windowSeconds * 1000) {
      return { allowed: false, retryAfter: Math.ceil((local.start + windowSeconds * 1000 - Date.now()) / 1000) }
    }
    return { allowed: true, retryAfter: 0 }
  }
}

const memoryFailures = new Map<string, { start: number; hits: number }>()

/** Count one failure (shared via Postgres; in-memory fallback). */
export async function recordRateLimitFailure(scope: string, identifier: string, limit: number, windowSeconds: number) {
  const key = rateLimitBucketKey(scope, identifier)
  try {
    const { error } = await (supabaseAdmin as any).rpc("consume_auth_rate_limit", {
      p_bucket_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) throw new Error(error.code ?? "error")
  } catch {
    const k = `${scope}:${key}`
    const cur = memoryFailures.get(k)
    const now = Date.now()
    if (!cur || now - cur.start >= windowSeconds * 1000) memoryFailures.set(k, { start: now, hits: 1 })
    else cur.hits += 1
  }
}

export async function resetRateLimit(scope: string, identifier: string) {
  const key = rateLimitBucketKey(scope, identifier)
  memoryFailures.delete(`${scope}:${key}`)
  try {
    await (supabaseAdmin as any).rpc("reset_auth_rate_limit", { p_bucket_key: key })
  } catch {
    /* best effort */
  }
}

/** Supervisor approval: 5 failed attempts per 15 min lock the supervisor and the cashier. */
export const SUPERVISOR_APPROVAL_LIMIT = { limit: 5, windowSeconds: 15 * 60 } as const
