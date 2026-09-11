import { NextResponse } from "next/server"
import { facilityInviteUrl } from "@synapse/db/facility-provision"
import { supabaseAdmin } from "@synapse/db/admin"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import {
  createFacilityInvitation,
  markFacilityInvitationDeliveryFailed,
  markFacilityInvitationSent,
} from "@/lib/platform/facility-invitations.server"
import { sendHospitalStaffInviteEmail } from "@/lib/resend"

export const dynamic = "force-dynamic"

/**
 * Hardened facility staff invitations.
 * Creates a single-use, hashed-token invitation via createFacilityInvitation,
 * emails a setup link (never a temporary password), and records delivery state.
 * Schema compatibility is enforced inside createFacilityInvitation — if the
 * acceptance-time migration is missing remotely this still returns 503
 * SCHEMA_INCOMPATIBLE rather than falling back to the legacy raw-token path.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdminApi("user.invite")
  if (!admin.ok) return admin.response

  const { id: tenantId } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const email = String(body.email ?? "").trim()
  const fullName = String(body.fullName ?? "").trim()
  const role = String(body.role ?? "").trim()
  const departmentRaw = body.departmentId
  const departmentId =
    departmentRaw == null || String(departmentRaw).trim() === ""
      ? null
      : String(departmentRaw).trim()

  const created = await createFacilityInvitation({
    tenantId,
    email,
    fullName,
    role,
    departmentId,
    actorId: admin.profile.id,
  })
  if (!created.ok) {
    return NextResponse.json({ code: created.code, error: created.error }, { status: created.status })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: tenant } = await db.from("tenants").select("slug, facility_type").eq("id", tenantId).maybeSingle()
  const slug = String(tenant?.slug ?? "facility")
  const facilityType = (tenant?.facility_type === "pharmacy" ? "pharmacy" : tenant?.facility_type === "hospital" ? "hospital" : "laboratory") as
    | "pharmacy"
    | "hospital"
    | "laboratory"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://synapseos.tech"
  const inviteUrl = facilityInviteUrl(facilityType, slug, created.token, { appUrl })

  try {
    await sendHospitalStaffInviteEmail({
      to: created.email,
      hospitalName: created.tenantName,
      staffName: fullName,
      role,
      inviteUrl,
    })
    await markFacilityInvitationSent(created.invitationId)
  } catch (err) {
    await markFacilityInvitationDeliveryFailed(
      created.invitationId,
      err instanceof Error ? err.message : "invite_email_send_failed",
    )
  }

  return NextResponse.json({
    ok: true,
    invitationId: created.invitationId,
    email: created.email,
    expiresAt: created.expiresAt,
    inviteUrl,
  })
}
