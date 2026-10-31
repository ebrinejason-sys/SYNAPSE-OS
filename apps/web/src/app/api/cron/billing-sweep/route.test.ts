import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const s = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: any }>,
  upserts: [] as any[],
  inserts: [] as Array<{ table: string; row: any }>,
  trials: [] as any[],
  admins: [] as any[],
}))

const email = vi.hoisted(() => ({
  sendRenewalReminder: vi.fn(async (_: any) => {}),
  sendPastDueNotice: vi.fn(async (_: any) => {}),
  sendSuspensionNotice: vi.fn(async (_: any) => {}),
}))

vi.mock("@synapse/email", () => email)

vi.mock("@synapse/db/admin", () => {
  const from = (table: string) => {
    let selected = ""
    const rows = () => {
      if (table === "profiles") return s.admins
      if (table === "tenant_subscriptions" && selected.includes("trial_ends")) return s.trials
      return []
    }
    const q: any = {
      select: (cols?: string) => ((selected = cols ?? ""), q),
      delete: () => q,
      eq: () => q,
      in: () => q,
      or: () => q,
      not: () => q,
      gte: () => q,
      lte: () => q,
      lt: () => q,
      limit: () => q,
      insert: async (row: any) => (s.inserts.push({ table, row }), { error: null }),
      upsert: async (v: any) => (table === "platform_billing_config" && s.upserts.push(v), { error: null }),
      maybeSingle: async () => ({ data: table === "tenants" ? { name: "Synthetic Pharmacy" } : null, error: null }),
      then: (res: any) => Promise.resolve({ data: rows(), count: 0, error: null }).then(res),
    }
    return q
  }
  return {
    supabaseAdmin: {
      from,
      rpc: async (fn: string, args: any) => {
        s.rpcCalls.push({ fn, args })
        return { data: { checked: 2, processed: 2 }, error: null }
      },
    },
  }
})

import { GET } from "./route"

const req = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/cron/billing-sweep", { headers })
const authed = () => req({ authorization: "Bearer test-cron-secret-value" })

const TENANT = "00000000-0000-4000-8000-0000000000aa"
const trialDueSoon = () => [
  { tenant_id: TENANT, trial_ends: new Date(Date.now() + 24 * 3600_000).toISOString(), subscription_plans: { name: "Starter", price_ugx: 1000 } },
]

describe("GET /api/cron/billing-sweep", () => {
  const prev = process.env.CRON_SECRET
  beforeEach(() => {
    s.rpcCalls.length = 0
    s.upserts.length = 0
    s.inserts.length = 0
    s.trials = []
    s.admins = []
    email.sendRenewalReminder.mockReset()
    email.sendRenewalReminder.mockImplementation(async () => {})
    process.env.CRON_SECRET = "test-cron-secret-value"
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prev
  })

  it("fails closed (503) and runs nothing when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req({ authorization: "Bearer anything" }))
    expect(res.status).toBe(503)
    expect(s.rpcCalls).toHaveLength(0)
  })

  it("rejects a missing or wrong secret with 401 and runs nothing", async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req({ authorization: "Bearer wrong" }))).status).toBe(401)
    expect((await GET(req({ "x-cron-secret": "wrong" }))).status).toBe(401)
    expect(s.rpcCalls).toHaveLength(0)
  })

  it("runs the subscription state machine with a valid Bearer secret (Vercel Cron)", async () => {
    const res = await GET(authed())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(s.rpcCalls).toEqual([{ fn: "advance_all_subscriptions", args: { p_actor: "cron" } }])
    expect(s.upserts[0]?.key).toBe("billing_sweep_last_run")
    expect(JSON.stringify(body)).not.toContain("test-cron-secret-value")
  })

  it("accepts the x-cron-secret header for manual runs", async () => {
    const res = await GET(req({ "x-cron-secret": "test-cron-secret-value" }))
    expect(res.status).toBe(200)
    expect(s.rpcCalls).toHaveLength(1)
  })

  it("a no-op run does not overwrite the last effective run record", async () => {
    await GET(authed())
    expect(s.upserts.map((u) => u.key)).toEqual(["billing_sweep_last_run"])
  })

  it("does not mark a reminder as sent when every delivery failed, so the next run retries", async () => {
    s.trials = trialDueSoon()
    s.admins = [{ email: "admin@synthetic.invalid", full_name: "Synthetic Admin" }]
    email.sendRenewalReminder.mockImplementation(async () => {
      throw new Error("email not accepted by Resend")
    })
    const body = await (await GET(authed())).json()
    expect(email.sendRenewalReminder).toHaveBeenCalledTimes(1)
    expect(s.inserts.filter((i) => i.table === "subscription_events")).toHaveLength(0)
    expect(body.reminders_sent).toBe(0)
    expect(body.reminders_failed).toBe(1)
    expect(body.emails_failed).toBe(1)
    // the failed attempt is still preserved as the effective run
    expect(s.upserts.map((u) => u.key)).toEqual(["billing_sweep_last_run", "billing_sweep_last_effective_run"])
  })

  it("marks the reminder as sent once delivered and keeps the effective-run record", async () => {
    s.trials = trialDueSoon()
    s.admins = [{ email: "admin@synthetic.invalid", full_name: "Synthetic Admin" }]
    const body = await (await GET(authed())).json()
    const events = s.inserts.filter((i) => i.table === "subscription_events")
    expect(events).toHaveLength(1)
    expect(events[0].row).toMatchObject({ tenant_id: TENANT, reason: "trial_reminder", actor: "cron" })
    expect(events[0].row.metadata).toMatchObject({ recipients: 1, delivered: 1 })
    expect(body.reminders_sent).toBe(1)
    expect(s.upserts.map((u) => u.key)).toEqual(["billing_sweep_last_run", "billing_sweep_last_effective_run"])
  })

  it("never persists or returns recipient email addresses", async () => {
    s.trials = trialDueSoon()
    s.admins = [{ email: "admin@synthetic.invalid", full_name: "Synthetic Admin" }]
    const body = await (await GET(authed())).json()
    expect(JSON.stringify(body)).not.toContain("admin@synthetic.invalid")
    expect(JSON.stringify(s.upserts)).not.toContain("admin@synthetic.invalid")
    expect(body.emails).toEqual([{ type: "trial_reminder", tenant_id: TENANT, ok: true }])
  })

  it("still dedupes tenants with no admin recipients (nothing to retry)", async () => {
    s.trials = trialDueSoon()
    s.admins = []
    const body = await (await GET(authed())).json()
    expect(s.inserts.filter((i) => i.table === "subscription_events")).toHaveLength(1)
    expect(body.reminders_sent).toBe(1)
  })
})
