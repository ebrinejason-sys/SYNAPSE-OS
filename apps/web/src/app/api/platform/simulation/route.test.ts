import { afterEach, describe, expect, it, vi } from "vitest"
import { roleHasCapability } from "../../../../lib/platform/rbac"

const { requirePlatformAdminApi, createDemoTenant, runScenario, resetDemoTenant, persistRunBestEffort, logPlatformEvent } = vi.hoisted(() => ({
  requirePlatformAdminApi: vi.fn(),
  createDemoTenant: vi.fn(),
  runScenario: vi.fn(),
  resetDemoTenant: vi.fn(),
  persistRunBestEffort: vi.fn(),
  logPlatformEvent: vi.fn(),
}))

vi.mock("@/lib/platform/auth", () => ({
  requirePlatformAdminApi: (...args: unknown[]) => requirePlatformAdminApi(...args),
}))

// Exercise the real capability table (imported relatively above) so tests
// reflect the actual production role -> capability mapping.
vi.mock("@/lib/platform/rbac", () => ({
  roleHasCapability: (...args: [string, string]) => roleHasCapability(...(args as [never, never])),
}))

vi.mock("@/app/platform/_lib/platform-data", () => ({
  logPlatformEvent: (...args: unknown[]) => logPlatformEvent(...args),
}))

vi.mock("@/lib/platform/simulation-runtime", () => ({
  createDemoTenant: (...args: unknown[]) => createDemoTenant(...args),
  getSimulationEngine: vi.fn(() => ({ runs: [] })),
  listDemoTenants: vi.fn(() => []),
  persistRunBestEffort: (...args: unknown[]) => persistRunBestEffort(...args),
  resetDemoTenant: (...args: unknown[]) => resetDemoTenant(...args),
  runScenario: (...args: unknown[]) => runScenario(...args),
  serializeRun: vi.fn((run: unknown) => run),
}))

function makeRequest(body: Record<string, unknown>) {
  return new Request("https://synapseos.tech/api/platform/simulation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function authorized(platformRole: string) {
  return { ok: true as const, profile: { id: "actor-1", platformRole } }
}

async function noMutation() {
  expect(createDemoTenant).not.toHaveBeenCalled()
  expect(runScenario).not.toHaveBeenCalled()
  expect(resetDemoTenant).not.toHaveBeenCalled()
  expect(logPlatformEvent).not.toHaveBeenCalled()
}

describe("POST /api/platform/simulation", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("requires simulation.manage (not simulation.read) for every mutating action", async () => {
    const denied = new Response(JSON.stringify({ code: "PLATFORM_FORBIDDEN" }), { status: 403 })
    requirePlatformAdminApi.mockResolvedValue({ ok: false, response: denied })

    const { POST } = await import("./route")
    for (const action of ["create_tenant", "run_scenario", "reset"]) {
      const res = await POST(makeRequest({ action }))
      expect(res.status).toBe(403)
    }
    expect(requirePlatformAdminApi).toHaveBeenCalledWith("simulation.manage")
    await noMutation()
  })

  it("forbids a read-only observer role from mutating even though it can read", async () => {
    // TECHNICAL_OBSERVER has simulation.read but not simulation.manage.
    requirePlatformAdminApi.mockImplementation(async (capability: string) =>
      capability === "simulation.manage"
        ? { ok: false, response: new Response(JSON.stringify({ code: "PLATFORM_FORBIDDEN" }), { status: 403 }) }
        : authorized("TECHNICAL_OBSERVER"),
    )

    const { POST } = await import("./route")
    for (const action of ["create_tenant", "run_scenario", "reset"]) {
      const res = await POST(makeRequest({ action, tenantId: "demo-1" }))
      expect(res.status).toBe(403)
    }
    await noMutation()
  })

  it("allows create_tenant and run_scenario for a role with simulation.manage", async () => {
    requirePlatformAdminApi.mockResolvedValue(authorized("PLATFORM_ADMIN"))
    createDemoTenant.mockResolvedValue({ id: "demo-1", kind: "hospital" })
    runScenario.mockReturnValue({ id: "run-1", seed: 1 })
    persistRunBestEffort.mockResolvedValue(undefined)
    logPlatformEvent.mockResolvedValue(undefined)

    const { POST } = await import("./route")
    const createRes = await POST(makeRequest({ action: "create_tenant", kind: "hospital" }))
    expect(createRes.status).toBe(200)
    expect(createDemoTenant).toHaveBeenCalled()

    const runRes = await POST(makeRequest({ action: "run_scenario", tenantId: "demo-1", scenario: "sepsis-critical-lab" }))
    expect(runRes.status).toBe(200)
    expect(runScenario).toHaveBeenCalled()
  })

  it("blocks reset for a role with simulation.manage but not tenant.manage", async () => {
    // CLINICAL_GOVERNANCE has simulation.manage but not tenant.manage.
    requirePlatformAdminApi.mockResolvedValue(authorized("CLINICAL_GOVERNANCE"))

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ action: "reset", tenantId: "demo-1" }))
    expect(res.status).toBe(403)
    expect(resetDemoTenant).not.toHaveBeenCalled()
    expect(logPlatformEvent).not.toHaveBeenCalled()
  })

  it("allows reset only for a role with both simulation.manage and tenant.manage", async () => {
    requirePlatformAdminApi.mockResolvedValue(authorized("PLATFORM_ADMIN"))
    resetDemoTenant.mockReturnValue(["removed-1"])
    logPlatformEvent.mockResolvedValue(undefined)

    const { POST } = await import("./route")
    const res = await POST(makeRequest({ action: "reset", tenantId: "demo-1" }))
    expect(res.status).toBe(200)
    expect(resetDemoTenant).toHaveBeenCalledWith("demo-1", "actor-1")
  })
})
