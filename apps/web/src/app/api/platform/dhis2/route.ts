export const dynamic = "force-dynamic"
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"
import {
  loadDhis2MonitorState,
  processPendingExports,
  retryExportJob,
  triggerAggregateExport,
} from "@/lib/platform/dhis2-export-actions"

export async function GET() {
  const { error } = await requirePlatformAdminApi()
  if (error) return error
  const state = await loadDhis2MonitorState()
  return NextResponse.json(state)
}

export async function POST(request: Request) {
  const { user, error } = await requirePlatformAdminApi()
  if (error || !user) return error

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action ?? "trigger")

  if (action === "trigger" || action === "export_aggregate") {
    const result = await triggerAggregateExport({
      actorId: user.id,
      actorRole: user.role ?? "platform_admin",
      tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
      period: typeof body.period === "string" ? body.period : null,
      orgUnit: typeof body.orgUnit === "string" ? body.orgUnit : null,
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  if (action === "retry") {
    const jobId = String(body.jobId ?? "")
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 })
    const result = await retryExportJob({
      actorId: user.id,
      actorRole: user.role ?? "platform_admin",
      jobId,
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  if (action === "process_pending" || action === "drain") {
    const result = await processPendingExports({
      actorId: user.id,
      actorRole: user.role ?? "platform_admin",
      limit: Number(body.limit ?? 25),
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
