import { NextResponse } from "next/server"
import { type PlatformCapability } from "@/lib/platform/rbac"
import { requirePlatformAdminApi as requireCanonicalPlatformAdminApi } from "@/lib/platform/auth"

export async function requirePlatformAdminApi(capability?: PlatformCapability) {
  const result = await requireCanonicalPlatformAdminApi(capability)

  if (!result.ok) {
    return { user: null, error: result.response }
  }

  return { user: result.profile, error: null }
}

export async function requirePlatformAdmin() {
  const result = await requireCanonicalPlatformAdminApi()
  return result.ok ? result.profile : null
}

export { hasPlatformAdminAccess } from "@/lib/platform/auth"
