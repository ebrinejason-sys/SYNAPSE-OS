import { NextResponse } from "next/server"
import {
  lookupFacilityInvitation,
  registerFacilityInvitationNewAccount,
} from "@/lib/platform/facility-invitations.server"

export const dynamic = "force-dynamic"

/**
 * New-account registration for a facility invitation.
 * Existing identities must use POST /api/invite/facility/accept instead.
 * Legacy raw-token lookup and password overwrite path is intentionally gone.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token ?? "").trim()
  const password = String(body.password ?? "")

  const preview = await lookupFacilityInvitation(token)
  if (!preview.ok) {
    return NextResponse.json({ code: preview.code, error: preview.error }, { status: preview.status })
  }
  if (preview.hasExistingAccount) {
    return NextResponse.json(
      {
        code: "IDENTITY_EXISTS",
        error: "An account already exists for this email. Sign in, then accept the invitation.",
      },
      { status: 409 },
    )
  }

  const result = await registerFacilityInvitationNewAccount({ token, password })
  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, profileId: result.profileId, tenantId: result.tenantId })
}
