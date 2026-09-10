import { NextResponse } from "next/server"
import { PRODUCT_MANIFEST, overallPlatformHealth } from "@synapse/config/manifest"
import { requirePlatformAdminApi } from "@/lib/platform/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requirePlatformAdminApi("capability.read")
  if (!gate.ok) return gate.response
  return NextResponse.json({
    ...PRODUCT_MANIFEST,
    overall: overallPlatformHealth(0),
  })
}
