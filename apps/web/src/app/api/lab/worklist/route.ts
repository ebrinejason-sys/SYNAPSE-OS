import { NextResponse } from "next/server"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"
import { getSimulationEngine, serializeRun } from "@/lib/platform/simulation-runtime"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error } = await requirePlatformAdminApi()
  if (error) return error
  const engine = getSimulationEngine()
  const orders = engine.lab.snapshot().orders.map((order) => {
    const run = engine.runs.find((item) => item.labOrder?.id === order.id)
    return {
      ...order,
      patientName: run?.patient?.demographics.fullName ?? null,
      synapseId: run?.patient?.synapseId ?? null,
    }
  })
  return NextResponse.json({
    orders,
    results: engine.lab.snapshot().results,
    runs: engine.runs.map(serializeRun),
  })
}
