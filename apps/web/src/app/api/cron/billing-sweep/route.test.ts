import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const s = vi.hoisted(() => ({ rpcCalls: [] as Array<{ fn: string; args: any }>, upserts: [] as any[] }))

vi.mock("@synapse/email", () => ({
  sendRenewalReminder: vi.fn(async () => {}),
  sendPastDueNotice: vi.fn(async () => {}),
  sendSuspensionNotice: vi.fn(async () => {}),
}))

vi.mock("@synapse/db/admin", () => {
  const from = (table: string) => {
    const q: any = {
      select: () => q,
      delete: () => q,
      eq: () => q,
      in: () => q,
      or: () => q,
      not: () => q,
      gte: () => q,
      lte: () => q,
      lt: () => q,
      limit: () => q,
      insert: async () => ({ error: null }),
      upsert: async (v: any) => (table === "platform_billing_config" && s.upserts.push(v), { error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (res: any) => Promise.resolve({ data: [], count: 0, error: null }).then(res),
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

describe("GET /api/cron/billing-sweep", () => {
  const prev = process.env.CRON_SECRET
  beforeEach(() => {
    s.rpcCalls.length = 0
    s.upserts.length = 0
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
    const res = await GET(req({ authorization: "Bearer test-cron-secret-value" }))
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
})
