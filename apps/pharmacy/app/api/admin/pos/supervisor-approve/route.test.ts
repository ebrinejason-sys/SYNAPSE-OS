import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { verifyDiscountApproval } from "@/lib/pos/discount-approval"

process.env.SYNAPSE_JWT_SECRET = process.env.SYNAPSE_JWT_SECRET || "test-only-secret-not-real-000000000000"

const s = vi.hoisted(() => ({
  session: null as any,
  settings: [] as any[],
  profiles: [] as any[],
  audit: [] as any[],
  buckets: new Map<string, { start: number; hits: number }>(),
  now: Date.now(),
}))

vi.mock("@/lib/auth", () => ({ getPharmacySession: async () => s.session }))
vi.mock("@synapse/auth/password", () => ({ verifyPassword: async (p: string, h: string) => h === `hash:${p}` }))
vi.mock("@/lib/capabilities", () => ({
  roleHasCapability: (role: string, cap: string) => cap === "pos.discount_override" && ["pharmacy_store_manager", "pharmacy_admin"].includes(role),
}))
vi.mock("@/lib/supabase/admin", () => {
  const live = (b?: { start: number; hits: number }, win = 0) => (b && b.start > s.now - win * 1000 ? b : undefined)
  return {
    supabaseAdmin: {
      rpc: async (fn: string, a: any) => {
        if (fn === "consume_auth_rate_limit") {
          const b = live(s.buckets.get(a.p_bucket_key), a.p_window_seconds)
          const next = b ? { start: b.start, hits: b.hits + 1 } : { start: s.now, hits: 1 }
          s.buckets.set(a.p_bucket_key, next)
          return { data: { allowed: next.hits <= a.p_limit, hits: next.hits, retry_after: 1 }, error: null }
        }
        if (fn === "auth_rate_limit_status") {
          const b = live(s.buckets.get(a.p_bucket_key), a.p_window_seconds)
          const retry = b ? Math.ceil((b.start + a.p_window_seconds * 1000 - s.now) / 1000) : 0
          return { data: { allowed: !(b && b.hits >= a.p_limit), hits: b?.hits ?? 0, retry_after: retry }, error: null }
        }
        if (fn === "reset_auth_rate_limit") {
          s.buckets.delete(a.p_bucket_key)
          return { data: null, error: null }
        }
        return { data: null, error: { message: "unknown" } }
      },
      from: (table: string) => {
        const eqs: Record<string, unknown> = {}
        const q: any = {
          select: () => q,
          eq: (k: string, v: unknown) => ((eqs[k] = v), q),
          insert: async (v: any) => (table === "pharmacy_audit_logs" && s.audit.push(v), { error: null }),
          maybeSingle: async () => {
            if (table === "pharmacy_user_settings")
              return { data: s.settings.find((r) => r.tenant_id === eqs.tenant_id && r.profile_id === eqs.profile_id) ?? null, error: null }
            if (table === "profiles") return { data: s.profiles.find((r) => r.id === eqs.id) ?? null, error: null }
            return { data: null, error: null }
          },
        }
        return q
      },
    },
  }
})

import { POST } from "./route"

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/pos/supervisor-approve", { method: "POST", body: JSON.stringify(body) })
const call = async (body: unknown) => {
  const r = await POST(req(body))
  return { status: r.status, body: await r.json() }
}

beforeEach(() => {
  s.now = Date.now()
  s.buckets = new Map()
  s.audit = []
  s.session = { userId: "cashier-1", tenantId: "tenant-1", profile: { tenant_id: "tenant-1" } }
  s.settings = [
    { tenant_id: "tenant-1", profile_id: "sup-1", pharmacy_role: "pharmacy_store_manager", is_active: true },
    { tenant_id: "tenant-1", profile_id: "sup-2", pharmacy_role: "pharmacy_store_manager", is_active: true },
    { tenant_id: "tenant-1", profile_id: "staff-1", pharmacy_role: "pharmacy_cashier", is_active: true },
    { tenant_id: "tenant-1", profile_id: "admin-flag", pharmacy_role: "pharmacy_cashier", is_active: true },
    { tenant_id: "tenant-1", profile_id: "inactive", pharmacy_role: "pharmacy_store_manager", is_active: false },
  ]
  s.profiles = [
    { id: "sup-1", email: "sup@x", full_name: "Sup One", password_hash: "hash:right", role: "pharmacy_store_manager", tenant_id: "tenant-1" },
    { id: "sup-2", email: "sup2@x", full_name: "Sup Two", password_hash: "hash:right2", role: "pharmacy_store_manager", tenant_id: "tenant-1" },
    { id: "staff-1", email: "s@x", password_hash: "hash:right", role: "pharmacy_cashier", tenant_id: "tenant-1" },
    { id: "admin-flag", email: "a@x", password_hash: "hash:right", role: "pharmacy_cashier", is_admin: true, tenant_id: "tenant-1" },
    { id: "inactive", email: "i@x", password_hash: "hash:right", role: "pharmacy_store_manager", tenant_id: "tenant-1" },
  ]
})

describe("POST /api/admin/pos/supervisor-approve", () => {
  it("401 without a session", async () => {
    s.session = null
    expect((await call({ supervisorId: "sup-1", password: "right" })).status).toBe(401)
  })

  it("approves a capable supervisor and returns a verifiable token bound to the cashier", async () => {
    const r = await call({ supervisorId: "sup-1", password: "right" })
    expect(r.status).toBe(200)
    expect(verifyDiscountApproval(r.body.approvalToken, { tenantId: "tenant-1", cashierId: "cashier-1" })).toBe("sup-1")
    expect(s.audit.at(-1).action).toBe("SUPERVISOR_APPROVAL_GRANTED")
  })

  it("every failure is the same generic 401 — never reveals which field was wrong", async () => {
    const outcomes = [
      await call({ supervisorId: "sup-1", password: "wrong" }), // wrong password
      await call({ supervisorId: "nobody", password: "right" }), // unknown supervisor
      await call({ supervisorId: "staff-1", password: "right" }), // not authorised
      await call({ supervisorId: "admin-flag", password: "right" }), // is_admin alone is not enough
      await call({ supervisorId: "inactive", password: "right" }), // deactivated
    ]
    for (const o of outcomes) {
      expect(o.status).toBe(401)
      expect(o.body).toEqual(outcomes[0].body)
    }
    expect(JSON.stringify(outcomes)).not.toMatch(/not found|incorrect|cannot approve|password set/i)
    expect(s.audit.map((a) => a.details.reason)).toEqual([
      "wrong_password",
      "supervisor_not_found_or_inactive",
      "not_authorised_to_approve",
      "not_authorised_to_approve",
      "supervisor_not_found_or_inactive",
    ])
  })

  it("locks out after 5 failures (even the right password is refused), with audit", async () => {
    for (let i = 0; i < 5; i += 1) expect((await call({ supervisorId: "sup-1", password: `bad${i}` })).status).toBe(401)
    const locked = await call({ supervisorId: "sup-1", password: "right" })
    expect(locked.status).toBe(429)
    expect(locked.body.code).toBe("APPROVAL_LOCKED")
    expect(s.audit.at(-1).action).toBe("SUPERVISOR_APPROVAL_LOCKED")
  })

  it("the lockout also follows the cashier (cannot rotate supervisors to keep guessing)", async () => {
    for (let i = 0; i < 5; i += 1) await call({ supervisorId: i % 2 ? "sup-1" : "sup-2", password: "bad" })
    expect((await call({ supervisorId: "sup-2", password: "right2" })).status).toBe(429)
  })

  it("recovers after the window", async () => {
    for (let i = 0; i < 5; i += 1) await call({ supervisorId: "sup-1", password: "bad" })
    expect((await call({ supervisorId: "sup-1", password: "right" })).status).toBe(429)
    s.now += 15 * 60 * 1000 + 1000
    expect((await call({ supervisorId: "sup-1", password: "right" })).status).toBe(200)
  })

  it("a success resets the failure count", async () => {
    for (let i = 0; i < 4; i += 1) await call({ supervisorId: "sup-1", password: "bad" })
    expect((await call({ supervisorId: "sup-1", password: "right" })).status).toBe(200)
    for (let i = 0; i < 4; i += 1) expect((await call({ supervisorId: "sup-1", password: "bad" })).status).toBe(401)
    expect((await call({ supervisorId: "sup-1", password: "right" })).status).toBe(200)
  })
})
