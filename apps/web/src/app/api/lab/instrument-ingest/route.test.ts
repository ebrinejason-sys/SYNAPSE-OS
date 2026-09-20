import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { lookupLabBridge, dbFrom } = vi.hoisted(() => ({
  lookupLabBridge: vi.fn(),
  dbFrom: vi.fn(),
}))

vi.mock("@/lib/lab-bridge-auth", () => ({
  lookupLabBridge: (...args: unknown[]) => lookupLabBridge(...args),
}))

vi.mock("@synapse/db/admin", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => dbFrom(...args) },
}))

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const DEVICE = "device-1"
const BRIDGE = { id: "bridge-1", tenant_id: TENANT, is_active: true, device_id: DEVICE }

function chain(result: { data?: unknown; error?: unknown }) {
  const api: Record<string, unknown> = {}
  const self = () => api
  for (const method of ["select", "eq", "insert", "update", "order", "limit"]) api[method] = vi.fn(self)
  api.maybeSingle = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }))
  api.then = (resolve: (value: { data: unknown; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject)
  return api
}

describe("POST /api/lab/instrument-ingest", () => {
  beforeEach(() => {
    lookupLabBridge.mockResolvedValue(BRIDGE)
  })
  afterEach(() => vi.resetModules())

  it("rejects an invalid bridge key", async () => {
    lookupLabBridge.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(new Request("https://os.test/api/lab/instrument-ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-lab-bridge-key": "bad" },
      body: JSON.stringify({ deviceId: DEVICE, rawPayload: "R|1|^^^WBC|6.8" }),
    }) as never)
    expect(res.status).toBe(401)
  })

  it("quarantines a bad ASTM checksum instead of staging a result", async () => {
    dbFrom.mockImplementation((table: string) => {
      if (table === "lab_devices") return chain({ data: { id: DEVICE, tenant_id: TENANT, active: true, validation_status: "ACTIVE" } })
      return chain({ data: { id: "msg-1" } })
    })
    const { POST } = await import("./route")
    const framed = `\u00021H|\\^&\u0003FF\r`
    const res = await POST(new Request("https://os.test/api/lab/instrument-ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-lab-bridge-key": "secret" },
      body: JSON.stringify({ deviceId: DEVICE, protocol: "ASTM", rawPayload: framed }),
    }) as never)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.quarantined).toBe(true)
  })

  it("does not ingest when the device is only CONNECTED", async () => {
    dbFrom.mockImplementation((table: string) => {
      if (table === "lab_devices") return chain({ data: { id: DEVICE, tenant_id: TENANT, active: true, validation_status: "CONNECTED" } })
      return chain({ data: null })
    })
    const { POST } = await import("./route")
    const res = await POST(new Request("https://os.test/api/lab/instrument-ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-lab-bridge-key": "secret" },
      body: JSON.stringify({ deviceId: DEVICE, rawPayload: "R|1|^^^WBC|6.8" }),
    }) as never)
    expect(res.status).toBe(403)
  })

  it("returns DUPLICATE for the same payload hash", async () => {
    dbFrom.mockImplementation((table: string) => {
      if (table === "lab_devices") return chain({ data: { id: DEVICE, tenant_id: TENANT, active: true, validation_status: "ACTIVE" } })
      if (table === "lab_device_messages") return chain({ data: { id: "existing-msg" } })
      return chain({ data: null })
    })
    const { POST } = await import("./route")
    const res = await POST(new Request("https://os.test/api/lab/instrument-ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-lab-bridge-key": "secret" },
      body: JSON.stringify({ deviceId: DEVICE, rawPayload: "R|1|^^^WBC|6.8", protocol: "ASTM" }),
    }) as never)
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.match).toBe("DUPLICATE")
  })
})
