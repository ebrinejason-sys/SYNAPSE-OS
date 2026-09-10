import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/auth"

export const dynamic = "force-dynamic"

/**
 * Facility staff invitations are fail-closed pending the acceptance-time
 * identity/membership migration (cryptographic token hashing, expiry,
 * single-use redemption, canonical membership creation). No flag re-enables
 * the legacy raw-token/profile-creation flow described in this handler's
 * history — the replacement must be implemented and verified end-to-end
 * before this route can return anything other than 503.
 */
export async function POST(_request: Request, { params: _params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdminApi("user.invite")
  if (!admin.ok) return admin.response
  return NextResponse.json(
    {
      code: "FACILITY_INVITE_HARDENING_REQUIRED",
      error: "Facility staff invitations are blocked until the acceptance-time identity migration is implemented and verified.",
    },
    { status: 503 },
  )
}
