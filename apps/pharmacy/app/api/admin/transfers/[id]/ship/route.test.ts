import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const { requirePharmacyPermission, rpc, transferMaybeSingle, logAudit } = vi.hoisted(() => ({
  requirePharmacyPermission: vi.fn(),
  rpc: vi.fn(),
  transferMaybeSingle: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requirePharmacyPermission: (...args: unknown[]) => requirePharmacyPermission(...args),
}))

vi.mock("@synapse/db", () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "pharmacy_stock_transfers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: transferMaybeSingle }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
    rpc,
  },
}))

import { POST } from "./route"

function sessionAuth() {
  return {
    ok: true as const,
    tenantId: "tenant-1",
    session: {
      userId: "manager-1",
      email: "m@test.com",
      role: "pharmacy_store_manager",
      pharmacyRole: "pharmacy_store_manager",
      tenantId: "tenant-1",
      fullName: "Manager",
      firstName: "Man",
      lastName: "Ager",
      isAdmin: false,
      tenantName: "Care",
      tenantSlug: "care",
      tenantStatus: "active",
      modulesEnabled: [],
      mustChangePassword: false,
      permissions: [],
      isImpersonation: false,
      impersonatorId: null,
      profile: {
        tenant_id: "tenant-1",
        is_admin: false,
        full_name: "Manager",
        first_name: "Man",
        last_name: "Ager",
      },
      user: { id: "manager-1", email: "m@test.com" },
    },
  }
}

function makeRequest(id: string) {
  return {
    url: `https://pharm.test/api/admin/transfers/${id}/ship`,
    method: "POST",
  } as any
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/admin/transfers/:id/ship", () => {
  beforeEach(() => {
    requirePharmacyPermission.mockReset()
    rpc.mockReset()
    transferMaybeSingle.mockReset()
    logAudit.mockReset()

    requirePharmacyPermission.mockResolvedValue(sessionAuth())
    transferMaybeSingle.mockResolvedValue({
      data: { id: "t1", status: "draft", from_store_id: "s1", to_store_id: "s2" },
      error: null,
    })
  })

  it("forbids callers without inventory.adjust", async () => {
    requirePharmacyPermission.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Missing capability: inventory.adjust" }, { status: 403 }),
    })
    const res = await POST(makeRequest("t1"), makeParams("t1"))
    expect(res.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("404s when the transfer does not belong to this tenant", async () => {
    transferMaybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest("t1"), makeParams("t1"))
    expect(res.status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("ships a draft transfer via the FEFO RPC and audits the action", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, transfer_id: "t1", items_shipped: 2, units_shipped: 15 },
      error: null,
    })
    const res = await POST(makeRequest("t1"), makeParams("t1"))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith(
      "ship_pharmacy_stock_transfer",
      expect.objectContaining({
        p_tenant_id: "tenant-1",
        p_transfer_id: "t1",
        p_actor_id: "manager-1",
      }),
    )
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, status: "in_transit", unitsShipped: 15 })
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SHIP_STOCK_TRANSFER", tenant_id: "tenant-1" }),
    )
  })

  it("maps a short source store to 409 INSUFFICIENT_STOCK", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "INSUFFICIENT_STOCK: Amoxicillin short by 5 units at source store" },
    })
    const res = await POST(makeRequest("t1"), makeParams("t1"))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("INSUFFICIENT_STOCK")
    expect(logAudit).not.toHaveBeenCalled()
  })

  it("rejects re-shipping a transfer that is already in_transit", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "INVALID_TRANSFER_STATE: expected draft, got in_transit" },
    })
    const res = await POST(makeRequest("t1"), makeParams("t1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("INVALID_TRANSFER_STATE")
  })
})
