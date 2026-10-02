import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ planQueries: [] as string[], failTable: "" as string }))

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
