import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { logPlatformEvent } from "@/app/platform/_lib/platform-data"

export const dynamic = "force-dynamic"

/**
 * Platform Admin: activate a pending user identity (sets email_verified_at).
 * Does not bypass activation guards — it satisfies them through the authorized control plane.
 */
export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdminApi("tenant.manage")
  if (!auth.ok) return auth.response

  const { id: userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "User id required" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, email, role, email_verified_at, is_deleted")
    .eq("id", userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profile?.id) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (profile.is_deleted) {
    return NextResponse.json({ error: "User is archived/deleted" }, { status: 409 })
  }

  if (!profile.email_verified_at) {
    const { error: updateError } = await db
      .from("profiles")
      .update({
        email_verified_at: new Date().toISOString(),
        verification_status: "verified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await logPlatformEvent({
    actorId: auth.profile.id,
    action: "user.activated",
    entityType: "profile",
    entityId: userId,
    metadata: { email: profile.email, role: profile.role, source: "api.platform.users.activate" },
  })

  return NextResponse.json({
    ok: true,
    userId,
    alreadyActivated: Boolean(profile.email_verified_at),
  })
}
