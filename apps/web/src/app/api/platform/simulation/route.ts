import { NextResponse } from "next/server"
import { SCENARIO_IDS, type DemoTenantKind, type ScenarioId } from "@synapse/db/simulation"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"
import { logPlatformEvent } from "@/app/platform/_lib/platform-data"
import {
  createDemoTenant,
  getSimulationEngine,
  listDemoTenants,
  persistRunBestEffort,
  resetDemoTenant,
  runScenario,
  serializeRun,
} from "@/lib/platform/simulation-runtime"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error } = await requirePlatformAdminApi()
  if (error) return error
  const engine = getSimulationEngine()
  return NextResponse.json({
    tenants: listDemoTenants(),
    runs: engine.runs.map(serializeRun),
    scenarios: SCENARIO_IDS,
  })
}

export async function POST(request: Request) {
  const { user, error } = await requirePlatformAdminApi()
  if (error || !user) return error
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action ?? "")

  try {
    if (action === "create_tenant") {
      const kind = (String(body.kind ?? "hospital") as DemoTenantKind) || "hospital"
      const tenant = await createDemoTenant({
        kind,
        name: typeof body.name === "string" ? body.name : undefined,
        actorId: user.id,
      })
      await logPlatformEvent({
        actorId: user.id,
        action: "simulation.tenant.create",
        entityType: "tenants",
        entityId: tenant.id,
        tenantId: tenant.id,
        metadata: { kind, synthetic: true },
      })
      return NextResponse.json({ tenant })
    }

    if (action === "run_scenario") {
      const tenantId = String(body.tenantId ?? "")
      const scenario = String(body.scenario ?? "sepsis-critical-lab") as ScenarioId
      if (!SCENARIO_IDS.includes(scenario)) {
        return NextResponse.json({ error: "Unknown scenario" }, { status: 400 })
      }
      const seed = Number(body.seed ?? 20260829)
      const pauseAt =
        body.pauseAt === "lab_order" || body.pauseAt === "result_entry" || body.pauseAt === "prescription"
          ? body.pauseAt
          : null
      const run = runScenario({
        seed: Number.isFinite(seed) ? seed : 20260829,
        scenario,
        tenantId,
        actorId: user.id,
        pauseAt,
      })
      await persistRunBestEffort(run)
      await logPlatformEvent({
        actorId: user.id,
        action: "simulation.run",
        entityType: "synapse_simulation_runs",
        entityId: run.id,
        tenantId,
        metadata: { scenario, seed: run.seed, synthetic: true },
      })
      return NextResponse.json({ run: serializeRun(run) })
    }

    if (action === "reset") {
      const tenantId = String(body.tenantId ?? "")
      const removed = resetDemoTenant(tenantId, user.id)
      await logPlatformEvent({
        actorId: user.id,
        action: "simulation.reset",
        entityType: "tenants",
        entityId: tenantId,
        tenantId,
        metadata: { removed, synthetic: true },
      })
      return NextResponse.json({ removed })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "simulation_failed"
    const status = message.includes("PRODUCTION") || message.includes("DEMO_TENANT") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
