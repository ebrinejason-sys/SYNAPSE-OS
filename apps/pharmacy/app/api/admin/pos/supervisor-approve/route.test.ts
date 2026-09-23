import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import type { PharmacySession } from "@/lib/auth"

vi.mock("@/lib/auth", () => ({
  getPharmacySession: vi.fn(),
}))

vi.mock("@synapse/auth/password", () => ({
  verifyPassword: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}))

vi.mock("@/lib/capabilities", () => ({
  roleHasCapability: vi.fn(),
}))

import { getPharmacySession } from "@/lib/auth"
import { verifyPassword } from "@synapse/auth/password"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { roleHasCapability } from "@/lib/capabilities"

const mockGetPharmacySession = getPharmacySession as unknown as ReturnType<typeof vi.fn>
const mockVerifyPassword = verifyPassword as unknown as ReturnType<typeof vi.fn>
const mockRoleHasCapability = roleHasCapability as unknown as ReturnType<typeof vi.fn>

function makeSession(overrides: Partial<PharmacySession> = {}): PharmacySession {
  return {
    userId: "user-1",
    email: "test@example.com",
    role: "pharmacy_cashier",
    tenantId: "tenant-1",
    fullName: "Test User",
    firstName: "Test",
    lastName: "User",
    isAdmin: false,
    tenantName: "Test Pharmacy",
    tenantSlug: "test-pharmacy",
    tenantStatus: "active",
    modulesEnabled: [],
    mustChangePassword: false,
    permissions: [],
    pharmacyRole: "pharmacy_cashier",
    isImpersonation: false,
    impersonatorId: null,
    storeId: null,
    profile: {
      tenant_id: "tenant-1",
      is_admin: false,
      full_name: "Test User",
      first_name: "Test",
      last_name: "User",
    },
    user: { id: "user-1", email: "test@example.com" },
    ...overrides,
  }
}

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/admin/pos/supervisor-approve", () => {
  it("returns 401 when no session", async () => {
    mockGetPharmacySession.mockResolvedValue(null)
    const req = makeRequest({ supervisorId: "sup-1", password: "test123" })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 403 when supervisor lacks pos.discount_override capability and is not pharmacy_admin", async () => {
    const session = makeSession({ tenantId: "tenant-1" })
    mockGetPharmacySession.mockResolvedValue(session)
    mockRoleHasCapability.mockReturnValue(false)

    const db = supabaseAdmin as any
    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: "sup-1", pharmacy_role: "pharmacy_cashier", is_active: true },
            }),
          }),
        }),
      }),
    })

    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "sup-1",
              email: "sup@example.com",
              full_name: "Supervisor",
              password_hash: "hash123",
              is_admin: false,
              role: "pharmacy_cashier",
              tenant_id: "tenant-1",
            },
          }),
        }),
      }),
    })

    const req = makeRequest({ supervisorId: "sup-1", password: "test123" })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain("cannot approve discounts")
  })

  it("succeeds when supervisor has pos.discount_override capability even without is_admin", async () => {
    const session = makeSession({ tenantId: "tenant-1" })
    mockGetPharmacySession.mockResolvedValue(session)
    mockRoleHasCapability.mockReturnValue(true)
    mockVerifyPassword.mockResolvedValue(true)

    const db = supabaseAdmin as any
    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: "sup-1", pharmacy_role: "pharmacy_store_manager", is_active: true },
            }),
          }),
        }),
      }),
    })

    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "sup-1",
              email: "sup@example.com",
              full_name: "Store Manager",
              password_hash: "hash123",
              is_admin: false,
              role: "pharmacy_store_manager",
              tenant_id: "tenant-1",
            },
          }),
        }),
      }),
    })

    const req = makeRequest({ supervisorId: "sup-1", password: "correctpass" })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.approved).toBe(true)
  })

  it("FAILS when user has is_admin=true but lacks capability (proves is_admin alone insufficient)", async () => {
    const session = makeSession({ tenantId: "tenant-1" })
    mockGetPharmacySession.mockResolvedValue(session)
    // User is marked is_admin=true but has a non-admin role (edge case)
    mockRoleHasCapability.mockReturnValue(false)

    const db = supabaseAdmin as any
    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: "sup-1", pharmacy_role: "pharmacy_cashier", is_active: true },
            }),
          }),
        }),
      }),
    })

    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "sup-1",
              email: "sup@example.com",
              full_name: "Fake Admin",
              password_hash: "hash123",
              is_admin: true, // marked admin but role is cashier
              role: "pharmacy_cashier",
              tenant_id: "tenant-1",
            },
          }),
        }),
      }),
    })

    const req = makeRequest({ supervisorId: "sup-1", password: "test123" })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain("cannot approve discounts")
  })

  it("succeeds when supervisor is pharmacy_admin role", async () => {
    const session = makeSession({ tenantId: "tenant-1" })
    mockGetPharmacySession.mockResolvedValue(session)
    mockRoleHasCapability.mockReturnValue(false) // doesn't have explicit capability
    mockVerifyPassword.mockResolvedValue(true)

    const db = supabaseAdmin as any
    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { profile_id: "sup-1", pharmacy_role: "pharmacy_admin", is_active: true },
            }),
          }),
        }),
      }),
    })

    db.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "sup-1",
              email: "admin@example.com",
              full_name: "Admin User",
              password_hash: "hash123",
              is_admin: false,
              role: "pharmacy_admin",
              tenant_id: "tenant-1",
            },
          }),
        }),
      }),
    })

    const req = makeRequest({ supervisorId: "sup-1", password: "correctpass" })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.approved).toBe(true)
  })
})
