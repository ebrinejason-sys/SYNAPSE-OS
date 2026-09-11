import { NextResponse } from "next/server"
import { lookupFacilityInvitation } from "@/lib/platform/facility-invitations.server"

export const dynamic = "force-dynamic"

/** Read-only invitation preview — routes the client to sign-in vs register without redeeming. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? ""
  const result = await lookupFacilityInvitation(token)
  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status })
  }
  return NextResponse.json({
    ok: true,
    email: result.email,
    tenantName: result.tenantName,
    hasExistingAccount: result.hasExistingAccount,
  })
}
