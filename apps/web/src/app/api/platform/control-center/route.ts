import { NextResponse } from "next/server"
import { ALL_CAPABILITIES, INTEGRATIONS, overallPlatformHealth } from "@synapse/config/manifest"
import { requirePlatformAdminApi } from "@/lib/platform/require-admin-api"
import { checkDatabaseLatency } from "@/app/platform/_lib/platform-data"
import { getSimulationEngine, listDemoTenants } from "@/lib/platform/simulation-runtime"

export const dynamic = "force-dynamic"

type ProbeStatus = "healthy" | "degraded" | "down" | "not_connected" | "not_configured"

type Probe = {
  id: string
  label: string
  url?: string
  status: ProbeStatus
  latencyMs: number | null
  detail: string
}

async function probeHttp(id: string, label: string, url: string): Promise<Probe> {
  const started = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" })
    clearTimeout(timer)
    const latencyMs = Date.now() - started
    if (!res.ok) {
      return { id, label, url, status: "degraded", latencyMs, detail: `HTTP ${res.status}` }
    }
    return { id, label, url, status: "healthy", latencyMs, detail: `HTTP ${res.status}` }
  } catch (error) {
    return {
      id,
      label,
      url,
      status: "not_connected",
      latencyMs: null,
      detail: error instanceof Error ? error.message : "unreachable",
    }
  }
}

export async function GET() {
  const { error } = await requirePlatformAdminApi()
  if (error) return error

  const db = await checkDatabaseLatency()
  const [web, admin, pharm, demo] = await Promise.all([
    probeHttp("web", "synapseos.tech", "https://synapseos.tech"),
    probeHttp("admin", "admin.synapseos.tech", "https://admin.synapseos.tech/platform/login"),
    probeHttp("pharm", "pharm.synapseos.tech", "https://pharm.synapseos.tech"),
    probeHttp("demo", "demo.synapseos.tech", "https://demo.synapseos.tech"),
  ])

  const github = process.env.GITHUB_TOKEN
    ? { id: "github", label: "GitHub", status: "healthy" as const, detail: "Token configured (no secrets returned)" }
    : { id: "github", label: "GitHub", status: "not_configured" as const, detail: "NOT CONFIGURED" }

  const vercel = process.env.VERCEL_TOKEN
    ? { id: "vercel", label: "Vercel", status: "healthy" as const, detail: "Token configured" }
    : { id: "vercel", label: "Vercel", status: "not_configured" as const, detail: "NOT CONFIGURED" }

  const eas = process.env.EXPO_TOKEN
    ? { id: "eas", label: "EAS / Expo", status: "healthy" as const, detail: "Token configured" }
    : { id: "eas", label: "EAS / Expo", status: "not_connected" as const, detail: "NOT CONNECTED" }

  const probes: Probe[] = [web, admin, pharm, demo]
  const down = probes.filter((item) => item.status === "down").length
  const overall = down > 0 ? "Critical" : probes.some((item) => item.status === "degraded") ? "Degraded" : overallPlatformHealth(0) === "INCIDENT" ? "Critical" : "Development"

  return NextResponse.json({
    overall,
    overallProjectStatus: overallPlatformHealth(0),
    generatedAt: new Date().toISOString(),
    database: {
      status: db.ok ? "healthy" : "not_connected",
      latencyMs: db.latencyMs,
      detail: db.ok ? "Connected" : "NOT CONNECTED",
    },
    products: ALL_CAPABILITIES.filter((item) => item.kind === "product").map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      projectStatus: item.projectStatus,
      telemetry: item.telemetry,
    })),
    surfaces: probes,
    integrations: INTEGRATIONS.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      lastSuccess: null,
      lastFailure: null,
      messagesToday: null,
      errorRate: null,
      adapterVersion: "unversioned",
      detail: item.limitation,
    })),
    github,
    vercel,
    eas,
    jobs: { status: "not_configured", detail: "NO TELEMETRY" },
    supabase: { status: db.ok ? "healthy" : "not_connected", detail: db.ok ? "Latency probe succeeded" : "NOT CONNECTED" },
    syntheticEnvironments: listDemoTenants().length,
    simulationRuns: getSimulationEngine().runs.length,
    deployments: {
      production: process.env.VERCEL_GIT_COMMIT_SHA
        ? { sha: process.env.VERCEL_GIT_COMMIT_SHA, status: "reported" }
        : { sha: null, status: "NOT CONFIGURED" },
    },
  })
}
