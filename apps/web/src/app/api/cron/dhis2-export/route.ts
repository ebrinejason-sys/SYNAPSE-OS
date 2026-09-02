import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import { processPendingDhis2Exports } from "@synapse/db/dhis2-export"
import { logPlatformEvent } from "@/app/platform/_lib/platform-data"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Nightly DHIS2 export worker — drains pending/failed aggregate jobs (simulation or live).
 * Schedule: 02:00 Africa/Kampala = 23:00 UTC (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
  }
  const auth = req.headers.get("authorization")
  const alt = req.headers.get("x-cron-secret")
  if (auth !== `Bearer ${secret}` && alt !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const results = await processPendingDhis2Exports(db, { limit: 25 })
  const succeeded = results.filter((row) => row.status === "succeeded").length
  const failed = results.filter((row) => row.status === "failed" || row.status === "dead").length

  await logPlatformEvent({
    actorId: "00000000-0000-4000-8000-000000000099",
    action: "dhis2.cron_drain",
    entityType: "dhis2_export_jobs",
    metadata: {
      processed: results.length,
      succeeded,
      failed,
      mode: process.env.DHIS2_MODE ?? "simulation",
    },
  })

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded,
    failed,
    results,
  })
}
