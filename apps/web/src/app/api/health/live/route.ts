import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Liveness probe — process is up. Do not depend on database or secrets.
 * Readiness belongs on /api/ready.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "live",
      checkedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
