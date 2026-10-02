import { beforeEach, describe, expect, it, vi } from "vitest"

const s = vi.hoisted(() => ({ provisionCalls: [] as any[] }))
vi.mock("../../../../lib/platform/auth", () => ({
  requirePlatformAdminApi: async () => ({ ok: true, profile: { id: "platform-admin" } }),
}))
vi.mock("../../../../lib/supabase/server", () => ({ createServiceClient: () => ({ from: () => ({}) }) }))
vi.mock("../../../../lib/resend", () => ({ sendHospitalStaffInviteEmail: async () => undefined }))
vi.mock("../../../platform/_lib/platform-data", () => ({ logPlatformEvent: async () => undefined }))
vi.mock("@synapse/db/facility-provision", () => ({
  facilityInviteUrl: () => "https://pharm.example/invite/facility/x",
  pharmacyLoginUrl: (slug: string) => `https://pharm.example/login?tenant=${slug}`,
  pharmacyTenantSlug: (v: string) => v,
  provisionFacility: async (_db: unknown, input: any) => {
    s.provisionCalls.push(input)
    return { ok: false, steps: [], warnings: [], status: "FAILED", error: "stop-here", runId: "r", slug: "s", tenantId: null }
  },
}))

import { POST } from "./route"
const post = (body: unknown) => POST(new Request("http://x/api/platform/pharmacies", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  s.provisionCalls = []
})

describe("POST /api/platform/pharmacies — new pharmacies get the annual plan only", () => {
  it.each(["pharm_monthly", "pharm_quarterly", "pharm_yearly", "pharmacy_starter"])("refuses planSlug=%s before provisioning", async (planSlug) => {
    const r = await post({ pharmacyName: "ZZ", adminEmail: "a@x.test", planSlug })
    expect(r.status).toBe(400)
    expect((await r.json()).code).toBe("PLAN_NOT_AVAILABLE")
    expect(s.provisionCalls).toHaveLength(0)
  })
  it("refuses a legacy plan slug smuggled through `plan`", async () => {
    const r = await post({ pharmacyName: "ZZ", adminEmail: "a@x.test", plan: "pharm_monthly" })
    expect(r.status).toBe(400)
    expect(s.provisionCalls).toHaveLength(0)
  })
  it("accepts the annual plan / legacy display tiers (billing plan is always annual)", async () => {
    await post({ pharmacyName: "ZZ", adminEmail: "a@x.test", planSlug: "synapse_pharmacy_annual" })
    await post({ pharmacyName: "ZZ", adminEmail: "a@x.test", plan: "starter" })
    expect(s.provisionCalls).toHaveLength(2)
  })
})
