import { NextResponse } from "next/server"
import { maskPatientId } from "@synapse/interop"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"
import { getSimulationEngine } from "@/lib/platform/simulation-runtime"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { error } = await requirePlatformAdminApi()
  if (error) return error
  const url = new URL(request.url)
  const correlationId = url.searchParams.get("correlationId") ?? undefined
  const tenantId = url.searchParams.get("tenantId") ?? undefined
  const simulationRunId = url.searchParams.get("simulationRunId") ?? undefined

  const memory = getSimulationEngine().outbox.list({ correlationId, tenantId, simulationRunId })
  let persisted: typeof memory = []
  try {
    const db = createServiceClient() as any
    let query = db
      .from("synapse_domain_events")
      .select(
        "event_id, event_type, source, occurred_at, correlation_id, causation_id, patient_id, tenant_id, status, retry_count, simulation_run_id, is_synthetic",
      )
      .order("occurred_at", { ascending: true })
      .limit(200)
    if (correlationId) query = query.eq("correlation_id", correlationId)
    if (tenantId) query = query.eq("tenant_id", tenantId)
    if (simulationRunId) query = query.eq("simulation_run_id", simulationRunId)
    const { data } = await query
    persisted = (data ?? []).map((row: Record<string, unknown>) => ({
      event_id: String(row.event_id),
      event_type: String(row.event_type) as never,
      version: "1.0.0",
      tenant_id: String(row.tenant_id ?? ""),
      timestamp: String(row.occurred_at ?? ""),
      correlation_id: String(row.correlation_id ?? ""),
      causation_id: (row.causation_id as string) ?? null,
      payload: {},
      source: String(row.source ?? "synapse-exchange") as never,
      idempotency_key: String(row.event_id),
      status: String(row.status ?? "pending") as never,
      retry_count: Number(row.retry_count ?? 0),
      patient_id: (row.patient_id as string) ?? null,
    }))
  } catch {
    persisted = []
  }

  const merged = [...persisted, ...memory].filter(
    (event, index, all) => all.findIndex((item) => item.event_id === event.event_id) === index,
  )

  return NextResponse.json({
    events: merged.map((event) => ({
      ...event,
      patient_id: maskPatientId(event.patient_id),
    })),
  })
}
