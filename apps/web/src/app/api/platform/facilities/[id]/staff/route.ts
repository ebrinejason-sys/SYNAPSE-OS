import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { hashPassword } from "@synapse/auth"
import { supabaseAdmin } from "@synapse/db/admin"
import { sendHospitalStaffInviteEmail } from "@/lib/resend"

export const dynamic = "force-dynamic"

const LAB_ROLES = new Set(["hospital_admin", "facility_admin", "lab_tech", "lab_scientist", "billing_officer", "quality_officer", "instrument_manager"])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdminApi("user.invite")
  if (!admin.ok) return admin.response
  if (process.env.FACILITY_INVITE_HARDENED !== "true") {
    return NextResponse.json(
      {
        code: "FACILITY_INVITE_HARDENING_REQUIRED",
        error: "Facility staff invitations are blocked until the acceptance-time identity migration is deployed.",
      },
      { status: 503 },
    )
  }
  const { id: tenantId } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""
  const role = typeof body.role === "string" ? body.role.trim() : ""
  const departmentId = typeof body.departmentId === "string" ? body.departmentId : null
  if (!email || !fullName || !LAB_ROLES.has(role)) return NextResponse.json({ error: "fullName, email and a valid laboratory role are required" }, { status: 400 })
  const db = supabaseAdmin as any
  const { data: tenant } = await db.from("tenants").select("id, name, facility_type").eq("id", tenantId).eq("facility_type", "laboratory").maybeSingle()
  if (!tenant) return NextResponse.json({ error: "Laboratory facility not found" }, { status: 404 })
  if (departmentId) {
    const { data: department } = await db.from("departments").select("id").eq("id", departmentId).eq("tenant_id", tenantId).maybeSingle()
    if (!department) return NextResponse.json({ error: "Section is outside this laboratory" }, { status: 403 })
  }
  const { data: existing } = await db.from("profiles").select("id, tenant_id").eq("email", email).maybeSingle()
  if (existing) return NextResponse.json({ error: existing.tenant_id === tenantId ? "Staff profile already exists in this laboratory" : "This account is already associated with another facility" }, { status: 409 })
  const profileId = randomUUID()
  const nameParts = fullName.split(/\s+/)
  const { error: profileError } = await db.from("profiles").insert({
    id: profileId, email, full_name: fullName, first_name: nameParts[0] ?? fullName,
    last_name: nameParts.slice(1).join(" ") || null, phone: typeof body.phone === "string" ? body.phone.trim() : null,
    role, tenant_id: tenantId, hospital_id: tenantId, department_id: departmentId,
    password_hash: await hashPassword(randomUUID()), must_change_password: true,
    onboarding_complete: false, verification_status: "verified", is_admin: role === "hospital_admin" || role === "facility_admin",
    created_by: admin.profile.id,
  })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  const token = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  const { data: invitation, error: inviteError } = await db.from("facility_invitations").insert({ tenant_id: tenantId, email, full_name: fullName, role, invite_token: token, status: "SENT", expires_at: expiresAt, sent_at: new Date().toISOString(), profile_id: profileId, created_by: admin.profile.id }).select("id, status, expires_at").single()
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://synapseos.tech"}/invite/facility/${token}`
  try {
    await sendHospitalStaffInviteEmail({ to: email, hospitalName: tenant.name, staffName: fullName, role, inviteUrl })
  } catch {
    await db.from("facility_invitations").update({ last_error: "Invitation email failed", updated_at: new Date().toISOString() }).eq("id", invitation.id)
  }
  return NextResponse.json({ ok: true, invitation, profileId, inviteUrl }, { status: 201 })
}
