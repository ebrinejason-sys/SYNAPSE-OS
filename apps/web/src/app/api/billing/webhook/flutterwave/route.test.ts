import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Real billing code (@synapse/auth handleFlutterwaveWebhook → confirmSubscriptionPayment);
// only the DB and the Flutterwave HTTP API are simulated.
const s = vi.hoisted(() => ({
  payments: [] as any[],
  invoices: [] as any[],
  activations: 0,
  periodExtensions: 0,
}))

vi.mock("@synapse/db/admin", () => {
  const from = (table: string) => {
    const rows = table === "subscription_payments" ? s.payments : table === "subscription_invoices" ? s.invoices : []
    const filters: Array<(r: any) => boolean> = []
    let patch: any = null
    let head = false
    const run = () => {
      const m = rows.filter((r) => filters.every((f) => f(r)))
      if (patch) m.forEach((r) => Object.assign(r, patch))
      return m
    }
    const q: any = {
      select: (_c?: string, opts?: any) => ((head = Boolean(opts?.head)), q),
      update: (p: any) => ((patch = p), q),
      insert: async (v: any) => {
        if (table === "subscription_invoices") {
          if (s.invoices.some((i) => i.payment_id === v.payment_id || i.invoice_no === v.invoice_no)) return { error: { code: "23505" } }
          s.invoices.push(v)
        }
        return { error: null }
      },
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      like: () => q,
      or: () => q,
      in: () => q,
      limit: () => q,
      order: () => q,
      gte: () => q,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (res: any) => Promise.resolve(head ? { count: run().length, error: null } : { data: run(), error: null }).then(res),
    }
    return q
  }
  return {
    supabaseAdmin: {
      from,
      // Mirrors activate_subscription_payment: row-locked, idempotent.
      rpc: async (fn: string, a: any) => {
        if (fn !== "activate_subscription_payment") return { data: null, error: null }
        const pay = s.payments.find((p) => p.id === a.p_payment_id)
        if (!pay) return { data: { ok: false, error: "payment_not_found" }, error: null }
        if (pay.status === "successful") return { data: { ok: true, idempotent: true }, error: null }
        pay.status = "successful"
        s.activations += 1
        s.periodExtensions += 1
        return { data: { ok: true, tenant_id: pay.tenant_id }, error: null }
      },
    },
  }
})

const SECRET = "test-webhook-hash-not-real"
const fetchMock = vi.fn(async (url: string) => {
  const id = String(url).match(/transactions\/([^/]+)\/verify/)?.[1]
  return new Response(
    JSON.stringify({ status: "success", data: { status: "successful", amount: 240000, currency: "UGX", tx_ref: `SYN-${id}`, id } }),
    { status: 200 },
  )
})

const hook = async (body: unknown, hash: string | null = SECRET) => {
  const { POST } = await import("./route")
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (hash !== null) headers["verif-hash"] = hash
  const res = await POST(new Request("http://x/api/billing/webhook/flutterwave", { method: "POST", headers, body: JSON.stringify(body) }) as any)
  return { status: res.status, body: await res.json() }
}
const charge = (txRef: string, id: string) => ({ event: "charge.completed", data: { status: "successful", tx_ref: txRef, id, amount: 240000, payment_type: "mobilemoneyug" } })

beforeEach(() => {
  process.env.FLUTTERWAVE_WEBHOOK_SECRET = SECRET
  process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-not-real"
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  s.payments = [
    { id: "pay-1", tenant_id: "t-1", plan_id: "plan-annual", status: "pending", amount_ugx: 240000, provider_tx_ref: "SYN-111", period_start: null, period_end: null, raw_payload: null },
  ]
  s.invoices = []
  s.activations = 0
  s.periodExtensions = 0
})
afterEach(() => vi.unstubAllGlobals())

describe("Flutterwave webhook (canonical: apps/web /api/billing/webhook/flutterwave)", () => {
  it("valid signature + successful charge activates exactly once and issues one invoice", async () => {
    const r = await hook(charge("SYN-111", "111"))
    expect(r.status).toBe(200)
    expect(s.activations).toBe(1)
    expect(s.invoices).toHaveLength(1)
  })
  it("duplicate webhook (retry) → no duplicate payment activation or invoice", async () => {
    await hook(charge("SYN-111", "111"))
    const again = await hook(charge("SYN-111", "111"))
    expect(again.status).toBe(200)
    expect(again.body.idempotent).toBe(true)
    expect(s.activations).toBe(1)
    expect(s.invoices).toHaveLength(1)
  })
  it("concurrent duplicate deliveries → one activation, one invoice", async () => {
    const [a, b] = await Promise.all([hook(charge("SYN-111", "111")), hook(charge("SYN-111", "111"))])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(s.activations).toBe(1)
    expect(s.periodExtensions).toBe(1)
    expect(s.invoices).toHaveLength(1)
  })
  it.each([["missing", null], ["wrong", "nope"], ["the API secret key", "FLWSECK_TEST-not-real"]])(
    "invalid signature (%s) → 401 and nothing changes",
    async (_label, hash) => {
      const r = await hook(charge("SYN-111", "111"), hash as string | null)
      expect(r.status).toBe(401)
      expect(s.payments[0].status).toBe("pending")
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/verify"), expect.anything())
    },
  )
  it("no webhook secret configured on the service → every delivery is refused", async () => {
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET
    expect((await hook(charge("SYN-111", "111"))).status).toBe(401)
  })
  it("unknown tx_ref → safe failure (422), no writes", async () => {
    const r = await hook(charge("SYN-UNKNOWN", "999"))
    expect(r.status).toBe(422)
    expect(r.body.error).toBe("payment_not_found")
    expect(s.activations).toBe(0)
  })
  it("amount below the plan price is not activated", async () => {
    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ status: "success", data: { status: "successful", amount: 1000, currency: "UGX", tx_ref: "SYN-111", id: "111" } })),
    )
    const r = await hook(charge("SYN-111", "111"))
    expect(r.status).toBe(422)
    expect(s.activations).toBe(0)
  })
})
