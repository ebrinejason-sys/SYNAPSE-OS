import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, validateSession } from "@synapse/auth"
import { SESSION_COOKIE } from "@synapse/config/constants"
import { acceptFacilityInvitationForExistingUser } from "@/lib/platform/facility-invitations.server"

export const dynamic = "force-dynamic"

/** Existing-user acceptance — requires an authenticated session whose email matches the invite. */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionToken) {
    return NextResponse.json({ code: "UNAUTHENTICATED", error: "Sign in to accept this invitation" }, { status: 401 })
  }

  let profileId: string
  try {
    const payload = await verifyToken(sessionToken)
    const { valid } = await validateSession(sessionToken)
    if (!valid || !payload?.sub) {
      return NextResponse.json({ code: "UNAUTHENTICATED", error: "Sign in to accept this invitation" }, { status: 401 })
    }
    profileId = payload.sub
  } catch {
    return NextResponse.json({ code: "UNAUTHENTICATED", error: "Sign in to accept this invitation" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token ?? "").trim()
  const result = await acceptFacilityInvitationForExistingUser({ token, sessionProfileId: profileId })
  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, profileId: result.profileId, tenantId: result.tenantId })
}
