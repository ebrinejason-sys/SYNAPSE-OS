import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  planQueries: [] as string[],
  failTable: "" as string,
  existingEmails: new Set<string>(),
  // Simulated shared Postgres bucket table (survives module re-imports = "another instance").
  buckets: new Map<string, { start: number; hits: number }>(),
  rpcKeys: [] as string[],
  now: () => Date.now(),
  rpcDown: false,
}))

vi.mock("@synapse/auth", () => ({
  createSession: vi.fn(async () => undefined),
  hashPassword: vi.fn(async () => "hashed"),
  signToken: vi.fn(async () => "tok"),
  validatePasswordStrength: () => ({ valid: true, errors: [] }),
  recordAndSendTrialReceipt: vi.fn(async () => undefined),
}))
vi.mock("@synapse/email", () => ({ sendWelcome: vi.fn(async () => undefined) }))
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: async (fn: string, a: any) => {
      if (fn !== "consume_auth_rate_limit" || m.rpcDown) return { data: null, error: { code: "PGRST000" } }
      m.rpcKeys.push(a.p_bucket_key)
      const now = m.now()
      const b = m.buckets.get(a.p_bucket_key)
      const fresh = !b || b.start <= now - a.p_window_seconds * 1000
      const next = fresh ? { start: now, hits: 1 } : { start: b!.start, hits: b!.hits + 1 }
      m.buckets.set(a.p_bucket_key, next)
      return {
        data: { allowed: next.hits <= a.p_limit, hits: next.hits, retry_after: Math.max(1, Math.ceil((next.start + a.p_window_seconds * 1000 - now) / 1000)) },
        error: null,
      }
    },
    from: (table: string) => {
      const eqs: Record<string, unknown> = {}
      const q: any = {
        select: () => q,
        delete: () => q,
        upsert: async () => ({ error: null }),
        eq: (k: string, v: unknown) => ((eqs[k] = v), q),
        insert: async () =>
          table === m.failTable
            ? { error: { code: "23505", message: 'duplicate key value violates unique constraint "tenants_slug_key" DETAIL: secret internals' } }
            : { error: null },
        maybeSingle: async () => {
          if (table === "subscription_plans") {
            m.planQueries.push(String(eqs.slug))
            return eqs.slug === "synapse_pharmacy_annual" && eqs.facility_type === "pharmacy"
              ? { data: { id: "plan-1", slug: "synapse_pharmacy_annual", name: "Pharmacy annual", billing_cycle: "yearly", price_ugx: 240000 }, error: null }
              : { data: null, error: null }
          }
          if (table === "profiles" && m.existingEmails.has(String(eqs.email))) return { data: { id: "existing" }, error: null }
          return { data: null, error: null }
        },
        then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
      }
      return q
    },
  },
}))

let ipCounter = 0
async function register(overrides: Record<string, unknown> = {}, ip?: string) {
  const { POST } = await import("./route")
  const { NextRequest } = await import("next/server")
  const body = {
    pharmacyName: "ZZ Synthetic Pharmacy",
    licenseNumber: "NDA-TEST-1",
    district: "Kampala",
    physicalAddress: "Plot 1",
    fullName: "Synthetic Admin",
    phone: "+256700000001",
    email: `synthetic+${Math.random().toString(36).slice(2)}@example.test`,
    password: "Str0ng!Passw0rd",
    pdpoConsent: true,
    ...overrides,
  }
  for (const k of Object.keys(body)) if ((body as any)[k] === undefined) delete (body as any)[k]
  const req = new NextRequest("https://pharm.synapseos.tech/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}` },
    body: JSON.stringify(body),
  })
  const res = await POST(req)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  m.planQueries = []
  m.failTable = ""
  m.existingEmails = new Set()
  m.buckets = new Map()
  m.rpcKeys = []
  m.now = () => Date.now()
  m.rpcDown = false
})

describe("pharmacy self-serve signup plan integrity", () => {
  it("defaults to synapse_pharmacy_annual when no plan is sent", async () => {
    const r = await register({ planSlug: undefined })
    expect(r.status).toBe(200)
    expect(m.planQueries).toEqual(["synapse_pharmacy_annual"])
    expect(r.body.planSlug).toBe("synapse_pharmacy_annual")
  })
  it.each(["pharm_monthly", "pharm_quarterly", "pharm_yearly", "synapse_os_basic_annual", "synapse_lab_annual", "hospital_starter"])(
    "rejects %s for a new signup before touching the database",
    async (slug) => {
      const r = await register({ planSlug: slug })
      expect(r.status).toBe(400)
      expect(r.body.code).toBe("PLAN_NOT_AVAILABLE")
      expect(m.planQueries).toEqual([])
    },
  )
  it("never returns raw database errors", async () => {
    m.failTable = "tenants"
    const r = await register({ planSlug: "synapse_pharmacy_annual" })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.body)).not.toMatch(/duplicate key|constraint|DETAIL|secret/i)
  })
  it("never returns raw errors from later provisioning steps either", async () => {
    m.failTable = "pharmacy_stores"
    const r = await register({ planSlug: "synapse_pharmacy_annual" })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.body)).not.toMatch(/duplicate key|constraint|DETAIL|secret/i)
  })
  it("rate-limits repeated signups from one IP (429 on the 6th within 15 min)", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) statuses.push((await register({ pharmacyName: "" }, "203.0.113.9")).status)
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
})

describe("distributed signup limiter (Postgres-backed)", () => {
  it("allows within the limit, then 429 with Retry-After", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) statuses.push((await register({ pharmacyName: "" }, "198.51.100.1")).status)
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400])
    expect(statuses[5]).toBe(429)
  })
  it("state is shared by a separate instance (fresh module import)", async () => {
    for (let i = 0; i < 5; i += 1) await register({ pharmacyName: "" }, "198.51.100.2")
    vi.resetModules()
    const r = await register({ pharmacyName: "" }, "198.51.100.2")
    expect(r.status).toBe(429)
  })
  it("the window expiring allows again", async () => {
    let t = Date.now()
    m.now = () => t
    for (let i = 0; i < 5; i += 1) await register({ pharmacyName: "" }, "198.51.100.3")
    expect((await register({ pharmacyName: "" }, "198.51.100.3")).status).toBe(429)
    t += 15 * 60 * 1000 + 1
    expect((await register({ pharmacyName: "" }, "198.51.100.3")).status).toBe(400)
  })
  it("per-email bucket: 3/hour across different IPs", async () => {
    const email = "target@example.test"
    const statuses: number[] = []
    for (let i = 0; i < 4; i += 1) statuses.push((await register({ email, pharmacyName: "" }, `192.0.2.${i + 10}`)).status)
    expect(statuses).toEqual([400, 400, 400, 429])
  })
  it("stores no raw identifiers (keys are 64-hex HMACs)", async () => {
    await register({ email: "pii@example.test", pharmacyName: "" }, "192.0.2.77")
    expect(m.rpcKeys.length).toBe(2)
    for (const k of m.rpcKeys) {
      expect(k).toMatch(/^[0-9a-f]{64}$/)
      expect(k).not.toContain("192.0.2.77")
      expect(k).not.toContain("pii")
    }
  })
  it("responses are identical whether or not the email already has an account", async () => {
    m.existingEmails.add("taken@example.test")
    m.failTable = "tenants" // a non-existence failure for comparison
    const existing = await register({ email: "taken@example.test" }, "192.0.2.90")
    const otherFailure = await register({ email: "fresh@example.test" }, "192.0.2.91")
    expect(existing.status).toBe(otherFailure.status)
    expect(existing.body).toEqual(otherFailure.body)
    expect(JSON.stringify(existing.body)).not.toMatch(/already exists/i)
    // and both are rate-limited identically
    m.existingEmails.add("taken2@example.test")
    const a: number[] = []
    const b: number[] = []
    for (let i = 0; i < 4; i += 1) a.push((await register({ email: "taken2@example.test" }, `192.0.2.${100 + i}`)).status)
    for (let i = 0; i < 4; i += 1) b.push((await register({ email: "fresh2@example.test" }, `192.0.2.${110 + i}`)).status)
    expect(a).toEqual(b)
  })
  it("falls back to the in-memory limiter (not fail-open) if the DB is unavailable", async () => {
    m.rpcDown = true
    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) statuses.push((await register({ pharmacyName: "" }, "198.51.100.99")).status)
    expect(statuses[5]).toBe(429)
  })
})
