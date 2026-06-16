import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../../lib/auth/getCurrentUser";
import { logPlatformEvent } from "../../../../platform/_lib/platform-data";

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  const profileId = body ? String(body.get("profile_id") ?? "").trim() : "";
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const db = createServiceClient() as any;
  const { error } = await db
    .from("profiles")
    .update({ locked_until: null, login_attempts: 0 })
    .eq("id", profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logPlatformEvent({
    actorId: actor.id,
    action: "user.unlocked",
    entityType: "profile",
    entityId: profileId,
    metadata: { unlocked_by: actor.email },
  });

  // Redirect back to security page
  return NextResponse.redirect(new URL("/platform/security", request.url));
}
