import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Server-issued proof that a supervisor approved an over-threshold discount.
 * Issued by /api/admin/pos/supervisor-approve after the supervisor's password
 * is verified, and bound to (tenant, cashier, supervisor, expiry) so a cashier
 * cannot forge approval by naming a supervisor id, nor replay another
 * cashier's or another pharmacy's approval.
 */
const TTL_MS = 8 * 60 * 60 * 1000 // one shift; offline queues replay within it

function key(): Buffer | null {
  const secret = process.env.SYNAPSE_JWT_SECRET
  if (!secret || secret.length < 16) return null
  return createHmac("sha256", secret).update("pos-discount-approval-v1").digest()
}

function mac(k: Buffer, payload: string): string {
  return createHmac("sha256", k).update(payload).digest("base64url")
}

export function signDiscountApproval(params: {
  tenantId: string
  cashierId: string
  supervisorId: string
  now?: number
}): string {
  const k = key()
  if (!k) throw new Error("Discount approval signing is not configured")
  const exp = (params.now ?? Date.now()) + TTL_MS
  const payload = Buffer.from(
    JSON.stringify({ t: params.tenantId, c: params.cashierId, s: params.supervisorId, e: exp }),
  ).toString("base64url")
  return `${payload}.${mac(k, payload)}`
}

/** Returns the verified supervisor id, or null for anything forged, expired or out of scope. */
export function verifyDiscountApproval(
  token: unknown,
  scope: { tenantId: string; cashierId: string; now?: number },
): string | null {
  if (typeof token !== "string" || !token.includes(".")) return null
  const k = key()
  if (!k) return null
  const [payload, sig] = token.split(".", 2)
  const expected = Buffer.from(mac(k, payload))
  const given = Buffer.from(sig ?? "")
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      t?: string; c?: string; s?: string; e?: number
    }
    if (data.t !== scope.tenantId || data.c !== scope.cashierId) return null
    if (typeof data.e !== "number" || data.e < (scope.now ?? Date.now())) return null
    return typeof data.s === "string" && data.s ? data.s : null
  } catch {
    return null
  }
}
