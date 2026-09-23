import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { roleHasCapability } from "@/lib/capabilities"
import { verifyPassword } from "@synapse/auth/password"
import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * Verify a supervisor password for over-threshold POS discounts.
 * Approver must have pos.discount_override (store manager / admin / finance).
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

  const { data: settings } = await db
    .from("pharmacy_user_settings")
    .select("profile_id, pharmacy_role, is_active")
    .eq("tenant_id", tenantId)
    .eq("profile_id", supervisorId)
    .maybeSingle()

  if (!settings || settings.is_active === false) {
    return NextResponse.json({ error: "Supervisor not found" }, { status: 404 })
  }

  const role = String(settings.pharmacy_role ?? "")
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, full_name, password_hash, is_admin, role, tenant_id")
    .eq("id", supervisorId)
    .maybeSingle()

  if (!profile || profile.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Supervisor not found" }, { status: 404 })
  }

  const elevated =
    roleHasCapability(role, "pos.discount_override") ||
    profile.role === "pharmacy_admin"

  if (!elevated) {
    return NextResponse.json({ error: "Selected user cannot approve discounts" }, { status: 403 })
  }

  if (!profile.password_hash) {
    return NextResponse.json({ error: "Supervisor has no password set" }, { status: 400 })
  }

  const ok = await verifyPassword(password, profile.password_hash as string)
  if (!ok) {
    return NextResponse.json({ error: "Incorrect supervisor password" }, { status: 401 })
  }

  return NextResponse.json({
    approved: true,
    supervisorId: profile.id,
    supervisorName: profile.full_name ?? profile.email,
  })
}
