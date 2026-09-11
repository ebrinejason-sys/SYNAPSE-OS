import { NextResponse } from "next/server"
import { hasRecentVerifiedMfa } from "@synapse/auth"
import { SCENARIO_IDS, type DemoTenantKind, type ScenarioId } from "@synapse/db/simulation"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { roleHasCapability } from "@/lib/platform/rbac"
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
  const gate = await requirePlatformAdminApi("simulation.read")
  if (!gate.ok) return gate.response
  const engine = getSimulationEngine()
  return NextResponse.json({
    tenants: listDemoTenants(),
    runs: engine.runs.map(serializeRun),
    scenarios: SCENARIO_IDS,
  })
}

export async function POST(request: Request) {
  // All mutating actions require the write capability; simulation.read is
  // observer-only and must never authorize create/run/reset.
  const gate = await requirePlatformAdminApi("simulation.manage")
  if (!gate.ok) return gate.response
  const user = gate.profile
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
      // Destructive: tenant.manage is an authorization requirement, not proof
      // of recent MFA — a second, higher-privilege capability on top of
      // simulation.manage plus a fresh, server-verified step-up (see
      // /api/platform/mfa/step-up and @synapse/auth hasRecentVerifiedMfa)
      // are both required before this can proceed.
      if (!roleHasCapability(user.platformRole, "tenant.manage")) {
        return NextResponse.json(
          { code: "PLATFORM_FORBIDDEN", error: "Resetting demo tenants requires tenant.manage in addition to simulation.manage" },
          { status: 403 },
        )
      }
      if (!(await hasRecentVerifiedMfa(user.id, user.sessionId))) {
        return NextResponse.json(
          { code: "MFA_STEP_UP_REQUIRED", error: "Resetting demo tenants requires a recent MFA step-up. Call /api/platform/mfa/step-up first." },
          { status: 403 },
        )
      }
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
