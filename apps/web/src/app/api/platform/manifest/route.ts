import { NextResponse } from "next/server"
import { PRODUCT_MANIFEST, overallPlatformHealth } from "@synapse/config/manifest"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error } = await requirePlatformAdminApi()
  if (error) return error
  return NextResponse.json({
    ...PRODUCT_MANIFEST,
    overall: overallPlatformHealth(0),
  })
}
