import { beforeEach, describe, expect, it, vi } from "vitest"

const s = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  invites: [] as any[],
  resets: [] as any[],
  failEmail: false,
}))

vi.mock("../../../../../lib/mobile-pharmacy-auth", () => ({
  requireMobilePharmacyAuth: async () => ({ userId: "admin-a", tenantId: "tenant-a", role: "pharmacy_admin" }),
  isMobileAuth: () => true,
  isMobilePharmacyAdmin: () => true,
}))
vi.mock("@synapse/auth/password", () => ({ hashPassword: async (p: string) => `bcrypt:${p.length}` }))
vi.mock("@synapse/email", () => ({
  sendInvite: async (p: any) => {
    if (s.failEmail) throw new Error("provider down")
    s.invites.push(p)
  },
  sendPasswordReset: async (p: any) => {
    if (s.failEmail) throw new Error("provider down")
    s.resets.push(p)
  },
}))
vi.mock("@synapse/db/admin", () => {
  const from = (table: string) => {
    const rows = (s.tables[table] ??= [])
    const filters: Array<(r: any) => boolean> = []
    let patch: any = null
    let ins: any = null
    let del = false
    const run = () => {
      if (ins) {
        rows.push(...(Array.isArray(ins) ? ins : [ins]))
        return []
      }
      const m = rows.filter((r) => filters.every((f) => f(r)))
      if (patch) m.forEach((r) => Object.assign(r, patch))
      if (del) m.forEach((r) => rows.splice(rows.indexOf(r), 1))
      return m
    }
    const q: any = {
      select: () => q,
      insert: (v: any) => ((ins = v), q),
      update: (v: any) => ((patch = v), q),
      delete: () => ((del = true), q),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      is: (c: string, v: any) => (filters.push((r) => (r[c] ?? null) === v), q),
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), q),
      order: () => q,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (res: any) => Promise.resolve({ data: run(), error: null }).then(res),
    }
    return q
  }
  return { supabaseAdmin: { from } }
})

import { PATCH, POST } from "./route"

const PASSWORD_LIKE = /pass(word)?|pwd|secret|temp_?pass|credential/i
const req = (body: unknown) => new Request("http://x/api/mobile/pharmacy/users", { method: "POST", body: JSON.stringify(body) }) as any
function assertNoPasswordFields(obj: unknown) {
  const walk = (v: any) => {
    if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) {
      expect(k).not.toMatch(PASSWORD_LIKE)
      walk(val)
    }
  }
  walk(obj)
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_PHARMACY_APP_URL = "https://pharm.example.test"
  s.invites = []
  s.resets = []
  s.failEmail = false
  s.tables = {
    profiles: [
      { id: "staff-a", email: "staff@a.test", full_name: "Staff A", tenant_id: "tenant-a", password_hash: "old" },
      { id: "victim-b", email: "victim@b.test", full_name: "Victim B", tenant_id: "tenant-b", password_hash: "victim-old" },
    ],
    pharmacy_user_settings: [
      { tenant_id: "tenant-a", profile_id: "staff-a", pharmacy_role: "pharmacy_staff" },
      { tenant_id: "tenant-b", profile_id: "victim-b", pharmacy_role: "pharmacy_admin" },
    ],
    password_reset_tokens: [],
    synapse_sessions: [],
    pharmacy_audit_logs: [],
  }
})

describe("mobile pharmacy users API never returns a password", () => {
  it("create: emails a single-use set-password link at the Pharmacy URL; response has no password-like field", async () => {
    const r = await POST(req({ name: "New Cashier", email: "New@A.test", role: "pharmacy_cashier" }))
    expect(r.status).toBe(200)
    const body = await r.json()
    assertNoPasswordFields(body)
    expect(body.inviteSent).toBe(true)
    expect(s.invites).toHaveLength(1)
    expect(s.invites[0].inviteUrl).toMatch(/^https:\/\/pharm\.example\.test\/reset-password\/[0-9a-f]{64}$/)
    expect(s.invites[0].tempPassword).toBeUndefined()
    const token = s.invites[0].inviteUrl.split("/").pop()
    // only the hash is stored
    expect(JSON.stringify(s.tables.password_reset_tokens)).not.toContain(token)
    expect(s.tables.password_reset_tokens[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
    // audit metadata carries no password
    assertNoPasswordFields(s.tables.pharmacy_audit_logs)
  })
  it("create: provider failure is reported as not sent (never as delivered)", async () => {
    s.failEmail = true
    const body = await (await POST(req({ name: "X", email: "x@a.test", role: "pharmacy_staff" }))).json()
    expect(body.inviteSent).toBe(false)
    expect(body.emailSent).toBe(false)
    assertNoPasswordFields(body)
  })
  it("reset: revokes sessions, emails a link, returns no password", async () => {
    s.tables.synapse_sessions.push({ user_id: "staff-a" })
    const r = await PATCH(req({ id: "staff-a", resetPassword: true }))
    expect(r.status).toBe(200)
    const body = await r.json()
    assertNoPasswordFields(body)
    expect(body.resetLinkSent).toBe(true)
    expect(s.resets[0].resetUrl).toMatch(/^https:\/\/pharm\.example\.test\/reset-password\//)
    expect(s.tables.synapse_sessions).toHaveLength(0)
    expect(s.tables.profiles[0].password_hash).not.toBe("old")
  })
  it("reset/edit of another tenant's user is refused (404) and nothing changes", async () => {
    const r = await PATCH(req({ id: "victim-b", resetPassword: true }))
    expect(r.status).toBe(404)
    expect(s.tables.profiles[1].password_hash).toBe("victim-old")
    const r2 = await PATCH(req({ id: "victim-b", name: "pwned" }))
    expect(r2.status).toBe(404)
    expect(s.tables.profiles[1].full_name).toBe("Victim B")
  })
  it("role changes are limited to known pharmacy roles", async () => {
    const r = await PATCH(req({ id: "staff-a", role: "platform_admin" }))
    expect(r.status).toBe(400)
    expect(s.tables.pharmacy_user_settings[0].pharmacy_role).toBe("pharmacy_staff")
  })
})
