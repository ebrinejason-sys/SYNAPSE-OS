import { NextResponse } from "next/server"
import { verifyStepUpMfa } from "@synapse/auth"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { checkRateLimit, rateLimiters } from "../../../../../lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Explicit step-up: an already-authenticated platform admin proves recent
 * possession of their existing authenticator immediately before a
 * destructive action. This does not replace or duplicate MFA — it reuses
 * the same mfa_enrollments enrollment already required for platform admin
 * login and simply stamps a fresh, server-verifiable timestamp that
 * hasRecentVerifiedMfa can check.
 */
export async function POST(request: Request) {
  const admin = await requirePlatformAdminApi()
  if (!admin.ok) return admin.response

  const rate = await checkRateLimit(rateLimiters.auth, `mfa-step-up:${admin.profile.id}:${admin.profile.sessionId}`)
  if (!rate.success) {
    return NextResponse.json({ code: "RATE_LIMITED", error: "Too many MFA attempts" }, { status: 429 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ code: "INVALID_CODE", error: "6-digit code required" }, { status: 400 })
  }

  const result = await verifyStepUpMfa(admin.profile.id, admin.profile.sessionId, code)
  if (!result.ok) {
    const status = result.code === "NOT_ENROLLED" ? 409 : result.code.endsWith("FAILED") ? 503 : 401
    return NextResponse.json({ code: result.code, error: result.code === "NOT_ENROLLED" ? "No verified authenticator enrolled" : "Incorrect code" }, { status })
  }

  return NextResponse.json({ ok: true })
}
