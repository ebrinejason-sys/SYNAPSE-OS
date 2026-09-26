import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signed customer-portal session. Previously the portal identified the
 * customer by a client-supplied `x-customer-id` header (read from
 * localStorage), which made the customer id a non-expiring bearer credential
 * and let any caller act as any customer whose id they held. The session is
 * now a server-signed, httpOnly cookie bound to (customer, tenant, expiry).
 */
export const CUSTOMER_SESSION_COOKIE = "synapse_customer_session"
export const CUSTOMER_SESSION_TTL_SECONDS = 12 * 60 * 60

function key(): Buffer | null {
  const secret = process.env.SYNAPSE_JWT_SECRET
  if (!secret || secret.length < 16) return null
  return createHmac("sha256", secret).update("pharmacy-customer-session-v1").digest()
}

function mac(k: Buffer, payload: string): string {
  return createHmac("sha256", k).update(payload).digest("base64url")
}

export function signCustomerSession(params: { customerId: string; tenantId: string; now?: number }): string {
  const k = key()
  if (!k) throw new Error("Customer session signing is not configured")
  const exp = (params.now ?? Date.now()) + CUSTOMER_SESSION_TTL_SECONDS * 1000
  const payload = Buffer.from(
    JSON.stringify({ c: params.customerId, t: params.tenantId, e: exp }),
  ).toString("base64url")
  return `${payload}.${mac(k, payload)}`
}

export function verifyCustomerSession(
  token: unknown,
  now: number = Date.now(),
): { customerId: string; tenantId: string } | null {
  if (typeof token !== "string" || !token.includes(".")) return null
  const k = key()
  if (!k) return null
  const [payload, sig] = token.split(".", 2)
  const expected = Buffer.from(mac(k, payload))
  const given = Buffer.from(sig ?? "")
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      c?: string; t?: string; e?: number
    }
    if (typeof data.e !== "number" || data.e < now) return null
    if (typeof data.c !== "string" || !data.c || typeof data.t !== "string" || !data.t) return null
    return { customerId: data.c, tenantId: data.t }
  } catch {
    return null
  }
}

/**
 * Resolve the authenticated customer for a request. Client-supplied
 * identity headers are ignored. When middleware resolved a tenant from a
 * custom domain (`x-tenant-id`, stripped of client values upstream), the
 * session must belong to that tenant.
 */
export function customerFromRequest(request: {
  cookies: { get(name: string): { value: string } | undefined }
  headers: { get(name: string): string | null }
}): { customerId: string; tenantId: string } | null {
  const session = verifyCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value)
  if (!session) return null
  const hostTenant = request.headers.get("x-tenant-id")
  if (hostTenant && hostTenant !== session.tenantId) return null
  return session
}
