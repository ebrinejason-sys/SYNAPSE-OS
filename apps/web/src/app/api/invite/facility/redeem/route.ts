import { NextResponse } from "next/server"
import { redeemFacilityInvitation } from "@/lib/platform/facility-invitations.server"

export const dynamic = "force-dynamic"

/**
 * Password activation / new-account registration for a facility invitation.
 * - Hardened platform staff invites (token_hash): create a new profile when none exists.
 * - Provisioned hospital/pharmacy invites (invite_token + pre-created profile): set password.
 * Existing identities that already have a password must use POST /api/invite/facility/accept.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token ?? "").trim()
  const password = String(body.password ?? "")

  const result = await redeemFacilityInvitation({ token, password })
  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, profileId: result.profileId, tenantId: result.tenantId })
}
