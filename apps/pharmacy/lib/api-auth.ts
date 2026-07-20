import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  getPharmacySession,
  isPharmacyAdmin,
  type PharmacySession,
} from "@/lib/auth"

export type PharmacyApiAuthFailure = {
  ok: false
  response: NextResponse
}

export type PharmacyApiSessionAuth = {
  ok: true
  session: PharmacySession
}

export type PharmacyApiTenantAuth = {
  ok: true
  session: PharmacySession
  tenantId: string
}

const PLATFORM_ROLES = new Set(["platform_admin", "superadmin"])

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

/** Authenticated pharmacy staff session (JSON 401, no redirect). */
export async function requirePharmacyApiSession(): Promise<
  PharmacyApiSessionAuth | PharmacyApiAuthFailure
> {
  const session = await getPharmacySession()
  if (!session) return { ok: false, response: unauthorizedResponse() }
  return { ok: true, session }
}

/**
 * Authenticated session with a non-empty tenant id from the session profile.
 * Never trusts body/query `tenant_id`.
 */
export async function requirePharmacyTenant(): Promise<
  PharmacyApiTenantAuth | PharmacyApiAuthFailure
> {
  const auth = await requirePharmacyApiSession()
  if (!auth.ok) return auth
  const tenantId = auth.session.tenantId || auth.session.profile.tenant_id
  if (!tenantId) {
    return { ok: false, response: forbiddenResponse("No tenant") }
  }
  return { ok: true, session: auth.session, tenantId }
}

/** Pharmacy owner / pharmacy_admin for the session tenant. */
export async function requirePharmacyAdmin(): Promise<
  PharmacyApiTenantAuth | PharmacyApiAuthFailure
> {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth
  if (!isPharmacyAdmin(auth.session)) {
    return { ok: false, response: forbiddenResponse("Admin only") }
  }
  return auth
}

/**
 * Permission check. Today pharmacy permissions collapse to admin
 * (matches legacy hasPermission). Kept as an explicit API so routes
 * do not re-implement ad-hoc role checks.
 */
export async function requirePharmacyPermission(
  _permission: string | string[],
): Promise<PharmacyApiTenantAuth | PharmacyApiAuthFailure> {
  return requirePharmacyAdmin()
}

/** Platform / superadmin only (cross-tenant tools). */
export async function requirePlatformAdmin(): Promise<
  PharmacyApiSessionAuth | PharmacyApiAuthFailure
> {
  const auth = await requirePharmacyApiSession()
  if (!auth.ok) return auth
  if (!PLATFORM_ROLES.has(auth.session.role)) {
    return {
      ok: false,
      response: forbiddenResponse("Forbidden — platform admin only"),
    }
  }
  return auth
}

/**
 * Ensure a loaded row belongs to the session tenant.
 * Returns a 404 (not 403) to avoid leaking cross-tenant existence.
 */
export function assertResourceTenant(
  sessionTenantId: string,
  resourceTenantId: string | null | undefined,
): PharmacyApiAuthFailure | { ok: true } {
  if (!resourceTenantId || resourceTenantId !== sessionTenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }
  return { ok: true }
}

/**
 * Trusted tenant for public/customer surfaces.
 * Prefers middleware-injected `x-tenant-id` (custom domain), then
 * explicit query/body only when provided as a second argument after
 * the caller opts in — never use untrusted headers alone.
 */
export function getTrustedRequestTenantId(
  request: NextRequest,
  fallback?: string | null,
): string | null {
  const fromHeader = request.headers.get("x-tenant-id")?.trim() || null
  if (fromHeader) return fromHeader
  const q = fallback?.trim()
  return q || null
}

/** Pure helpers exported for unit tests (no Next cookies). */
export const __test__ = {
  isPlatformRole: (role: string) => PLATFORM_ROLES.has(role),
  resolveTenantId: (session: Pick<PharmacySession, "tenantId" | "profile">) =>
    session.tenantId || session.profile.tenant_id || "",
  assertResourceTenant,
}
