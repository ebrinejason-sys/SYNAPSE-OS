import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Demo playground readiness. Intentionally independent of OS /api/ready
 * database probes so Demo never needs a production service-role key.
 */
export async function GET() {
  return NextResponse.json({
    status: "ready",
    mode: "synthetic-playground",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionWrites: false,
  })
}
