import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { roleHasCapability } from "@/lib/capabilities"
import { verifyPassword } from "@synapse/auth/password"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { signDiscountApproval } from "@/lib/pos/discount-approval"
import {
  SUPERVISOR_APPROVAL_LIMIT,
  rateLimitStatus,
  recordRateLimitFailure,
  resetRateLimit,
} from "@/lib/distributed-rate-limit"

// A valid bcrypt hash of a random string: verifying against it equalises timing when
// the supervisor does not exist / has no password, without any separate password store.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.zN8kJp6Cq9mI8zVwO5Hn7yYV4m7e"
const GENERIC_FAILURE = "Approval failed. Check the supervisor and password and try again."

/**
 * Verify a supervisor password for over-threshold POS discounts.
 * Approver must have pos.discount_override (store manager / admin / finance).
 *
 * Brute-force protection: 5 failures / 15 min (shared Postgres limiter) lock both
 * the targeted supervisor and the requesting cashier until the window ends. Every
 * failure returns the same generic 401 (never which field was wrong); a success
 * resets both counters. All outcomes are audited.
 */
export async function POST(request: NextRequest) {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const tenantId = session.tenantId || session.profile.tenant_id
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supervisorId = typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  if (!supervisorId || !password) {
    return NextResponse.json({ error: "supervisorId and password are required" }, { status: 400 })
  }

  const db = supabaseAdmin as any
  const { limit, windowSeconds } = SUPERVISOR_APPROVAL_LIMIT
  const supScope = "pos-supervisor-approve:supervisor"
  const cashScope = "pos-supervisor-approve:cashier"
  const supId = `${tenantId}:${supervisorId}`
  const cashId = `${tenantId}:${session.userId}`

  const audit = async (action: string, details: Record<string, unknown>) => {
    try {
      await db.from("pharmacy_audit_logs").insert({
        tenant_id: tenantId,
        profile_id: session.userId,
        action,
        entity: "POS_SUPERVISOR_APPROVAL",
        entity_id: supervisorId,
        details,
      })
    } catch {
      /* audit is best effort; never blocks the response */
    }
  }

  const [supStatus, cashStatus] = await Promise.all([
    rateLimitStatus(supScope, supId, limit, windowSeconds),
    rateLimitStatus(cashScope, cashId, limit, windowSeconds),
  ])
  if (!supStatus.allowed || !cashStatus.allowed) {
    const retryAfter = Math.max(supStatus.retryAfter, cashStatus.retryAfter, 1)
    await audit("SUPERVISOR_APPROVAL_LOCKED", { retry_after_s: retryAfter })
    return NextResponse.json(
      { error: "Too many failed approval attempts. Try again later.", code: "APPROVAL_LOCKED" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    )
  }

  const fail = async (reason: string) => {
    await Promise.all([
      recordRateLimitFailure(supScope, supId, limit, windowSeconds),
      recordRateLimitFailure(cashScope, cashId, limit, windowSeconds),
    ])
    // The specific reason is kept in the audit trail only, never in the response.
    await audit("SUPERVISOR_APPROVAL_FAILED", { reason })
    return NextResponse.json({ error: GENERIC_FAILURE, code: "APPROVAL_FAILED" }, { status: 401 })
  }

  const { data: settings } = await db
    .from("pharmacy_user_settings")
    .select("profile_id, pharmacy_role, is_active")
    .eq("tenant_id", tenantId)
    .eq("profile_id", supervisorId)
    .maybeSingle()

  const { data: profile } = settings
    ? await db
        .from("profiles")
        .select("id, email, full_name, password_hash, is_admin, role, tenant_id")
        .eq("id", supervisorId)
        .maybeSingle()
    : { data: null }

  const role = String(settings?.pharmacy_role ?? "")
  const usable = Boolean(settings && settings.is_active !== false && profile && profile.tenant_id === tenantId)
  const elevated = usable && (roleHasCapability(role, "pos.discount_override") || profile.role === "pharmacy_admin")
  const hash = usable && elevated && profile.password_hash ? String(profile.password_hash) : DUMMY_HASH
  const passwordOk = await verifyPassword(password, hash).catch(() => false)

  if (!usable) return fail("supervisor_not_found_or_inactive")
  if (!elevated) return fail("not_authorised_to_approve")
  if (!profile.password_hash) return fail("no_password_set")
  if (!passwordOk) return fail("wrong_password")

  let approvalToken: string
  try {
    approvalToken = signDiscountApproval({
      tenantId,
      cashierId: session.userId,
      supervisorId: profile.id as string,
    })
  } catch {
    return NextResponse.json({ error: "Discount approval is not configured" }, { status: 503 })
  }

  await Promise.all([resetRateLimit(supScope, supId), resetRateLimit(cashScope, cashId)])
  await audit("SUPERVISOR_APPROVAL_GRANTED", { supervisor_id: profile.id })

  return NextResponse.json({
    approved: true,
    approvalToken,
    supervisorId: profile.id,
    supervisorName: profile.full_name ?? profile.email,
  })
}
