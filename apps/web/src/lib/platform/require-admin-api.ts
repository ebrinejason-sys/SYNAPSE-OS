import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { hasPlatformAdminAccess } from "@/lib/platform/auth"

export async function requirePlatformAdminApi() {
  const user = await getCurrentUser()
  if (!user || !hasPlatformAdminAccess(user.role, user.email)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { user, error: null }
}
