import { beforeEach, describe, expect, it, vi } from "vitest"
import { generateFacilityInviteToken, hashFacilityInviteToken } from "@synapse/db/facility-invite-token"

const t = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, passwordWrites: 0 }))
vi.mock("@synapse/auth", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  signToken: vi.fn(async () => "jwt"),
  createSession: vi.fn(async () => undefined),
}))
vi.mock("@/lib/supabase/admin", () => {
  const from = (table: string) => {
    const rows = (t.tables[table] ??= [])
    const filters: Array<(r: any) => boolean> = []
    let patch: any = null
    const match = () => rows.filter((r) => filters.every((f) => f(r)))
    const run = () => {
      const m = match()
      if (patch) {
        if (table === "profiles" && "password_hash" in patch) t.passwordWrites += m.length
        m.forEach((r) => Object.assign(r, patch))
      }
      return m
    }
    const q: any = {
      select: () => q,
      update: (p: any) => ((patch = p), q),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), q),
      gt: (c: string, v: any) => (filters.push((r) => String(r[c]) > String(v)), q),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (res: any) => Promise.resolve({ data: run(), error: null }).then(res),
    }
    return q
  }
  return { supabaseAdmin: { from } }
})

import { POST } from "./route"

let token: string
const req = (body: unknown) => new Request("http://x/api/invite/facility/redeem", { method: "POST", body: JSON.stringify(body) }) as any

beforeEach(() => {
  token = generateFacilityInviteToken()
  t.passwordWrites = 0
  t.tables = {
    facility_invitations: [
      { id: "inv-1", tenant_id: "ten-1", profile_id: "p-1", email: "a@x.test", role: "pharmacy_admin", status: "SENT",
        expires_at: new Date(Date.now() + 86400000).toISOString(), token_hash: hashFacilityInviteToken(token), invite_token: null },
    ],
    tenants: [{ id: "ten-1", facility_type: "pharmacy", status: "active", is_active: true }],
    profiles: [{ id: "p-1", email: "a@x.test", role: "pharmacy_admin", tenant_id: "ten-1", password_hash: null }],
  }
})

describe("POST /api/invite/facility/redeem (hashed, single-use)", () => {
  it("valid token sets the password once and marks the invite ACCEPTED", async () => {
    const r = await POST(req({ token, password: "Str0ngPass!" }))
    expect(r.status).toBe(200)
    expect(t.tables.profiles[0].password_hash).toBe("hashed:Str0ngPass!")
    expect(t.tables.facility_invitations[0].status).toBe("ACCEPTED")
    expect(t.passwordWrites).toBe(1)
  })
  it("invalid token → 404, nothing written", async () => {
    const r = await POST(req({ token: generateFacilityInviteToken(), password: "Str0ngPass!" }))
    expect(r.status).toBe(404)
    expect(t.passwordWrites).toBe(0)
  })
  it("the stored hash cannot be used as the token", async () => {
    const r = await POST(req({ token: t.tables.facility_invitations[0].token_hash, password: "Str0ngPass!" }))
    expect(r.status).toBe(404)
    expect(t.passwordWrites).toBe(0)
  })
  it("expired → 410, nothing written", async () => {
    t.tables.facility_invitations[0].expires_at = new Date(Date.now() - 1000).toISOString()
    const r = await POST(req({ token, password: "Str0ngPass!" }))
    expect(r.status).toBe(410)
    expect(t.passwordWrites).toBe(0)
  })
  it("used → 409", async () => {
    t.tables.facility_invitations[0].status = "ACCEPTED"
    const r = await POST(req({ token, password: "Str0ngPass!" }))
    expect(r.status).toBe(409)
    expect(t.passwordWrites).toBe(0)
  })
  it("replay after success cannot overwrite the password", async () => {
    expect((await POST(req({ token, password: "Str0ngPass!" }))).status).toBe(200)
    const replay = await POST(req({ token, password: "Attack3rPass!" }))
    expect(replay.status).toBe(409)
    expect(t.tables.profiles[0].password_hash).toBe("hashed:Str0ngPass!")
    expect(t.passwordWrites).toBe(1)
  })
  it("two concurrent redemptions: exactly one writes a password", async () => {
    const [a, b] = await Promise.all([POST(req({ token, password: "Str0ngPass!" })), POST(req({ token, password: "Other0Pass!" }))])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(t.passwordWrites).toBe(1)
  })
})
