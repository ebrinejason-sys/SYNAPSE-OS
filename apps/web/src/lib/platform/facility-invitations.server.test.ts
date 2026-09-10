import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

/**
 * Minimal in-memory Supabase-query-builder fake supporting exactly the
 * chains used by facility-invitations.server.ts: select/eq/in/limit,
 * maybeSingle/single, insert(...).select(...).single()/maybeSingle(), and
 * update(...).eq(...).in(...).select(...).maybeSingle() for the conditional
 * single-use claim. Good enough to exercise real business-logic branches
 * instead of just asserting spy calls.
 */
function makeFakeDb(tables: Record<string, Record<string, unknown>[]>) {
  const schemaBroken = { value: false }

  function query(table: string) {
    let rows = tables[table] ?? (tables[table] = [])
    let pendingInsert: Record<string, unknown>[] | null = null
    let pendingUpdate: Record<string, unknown> | null = null
    const filters: Array<(row: Record<string, unknown>) => boolean> = []

    function applyFilters(list: Record<string, unknown>[]) {
      return list.filter((row) => filters.every((f) => f(row)))
    }

    const builder: Record<string, unknown> = {
      select(cols: string) {
        if (table === "facility_invitations" && schemaBroken.value && /token_hash|redeemed_by/.test(cols)) {
          builder.__forceError = "column facility_invitations.token_hash does not exist"
        }
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val)
        return builder
      },
      in(col: string, vals: unknown[]) {
        filters.push((row) => vals.includes(row[col]))
        return builder
      },
      limit() {
        return Promise.resolve(builder.__forceError ? { data: null, error: { message: builder.__forceError } } : { data: applyFilters(rows).slice(0, 1), error: null })
      },
      maybeSingle() {
        if (builder.__forceError) return Promise.resolve({ data: null, error: { message: builder.__forceError } })
        if (pendingUpdate) {
          const matches = applyFilters(rows)
          for (const row of matches) Object.assign(row, pendingUpdate)
          return Promise.resolve({ data: matches[0] ?? null, error: null })
        }
        if (pendingInsert) {
          rows.push(...pendingInsert)
          return Promise.resolve({ data: pendingInsert[0] ?? null, error: null })
        }
        const matches = applyFilters(rows)
        return Promise.resolve({ data: matches[0] ?? null, error: null })
      },
      single() {
        if (pendingInsert) {
          rows.push(...pendingInsert)
          return Promise.resolve({ data: pendingInsert[0] ?? null, error: null })
        }
        const matches = applyFilters(rows)
        return Promise.resolve({ data: matches[0] ?? null, error: null })
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        pendingInsert = Array.isArray(row) ? row : [row]
        return builder
      },
      update(patch: Record<string, unknown>) {
        pendingUpdate = patch
        return builder
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        // Awaiting the builder directly (no terminal call) resolves after
        // applying any pending insert/update, matching real supabase-js
        // thenable query builders.
        if (pendingInsert) {
          rows.push(...pendingInsert)
          return resolve({ data: pendingInsert, error: null })
        }
        if (pendingUpdate) {
          const matches = applyFilters(rows)
          for (const row of matches) Object.assign(row, pendingUpdate)
          return resolve({ data: matches, error: null })
        }
        return resolve({ data: applyFilters(rows), error: null })
      },
    }
    return builder
  }

  return {
    from: (table: string) => query(table),
    __breakSchema: () => {
      schemaBroken.value = true
    },
    __tables: tables,
  }
}

const { hashPassword } = vi.hoisted(() => ({ hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`) }))
vi.mock("@synapse/auth", () => ({
  hashPassword,
  hashToken: (token: string) => createHash("sha256").update(token).digest("hex"),
}))

let fakeDb: ReturnType<typeof makeFakeDb>
vi.mock("@synapse/db/admin", () => ({
  get supabaseAdmin() {
    return fakeDb
  },
}))

function seed() {
  fakeDb = makeFakeDb({
    tenants: [{ id: "lab-1", name: "Pilot Lab", facility_type: "laboratory" }],
    departments: [{ id: "dept-1", tenant_id: "lab-1" }],
    profiles: [],
    facility_invitations: [],
    staff_scope_assignments: [],
  })
}

describe("facility-invitations.server", () => {
  beforeEach(() => {
    seed()
    vi.clearAllMocks()
  })

  it("refuses to create an invitation when the schema is not compatible", async () => {
    fakeDb.__breakSchema()
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "new@example.test", fullName: "New Person", role: "lab_tech", actorId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("SCHEMA_INCOMPATIBLE")
  })

  it("creates an invitation with a fresh identity, storing only a token hash", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "new@example.test", fullName: "New Person", role: "lab_tech", actorId: "admin-1" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.token).toBeTruthy()
    const rows = fakeDb.__tables.facility_invitations
    expect(rows).toHaveLength(1)
    expect(rows[0].invite_token).toBeNull()
    expect(rows[0].token_hash).not.toBe(result.token)
    expect(String(rows[0].token_hash)).not.toContain(result.token)
  })

  it("rejects invitation creation when the identity is already scoped to another facility", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    fakeDb.__tables.profiles.push({ id: "existing-1", email: "taken@example.test", tenant_id: "other-tenant" })
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "taken@example.test", fullName: "Taken Person", role: "lab_tech", actorId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("IDENTITY_SCOPE_CONFLICT")
  })

  it("rejects a duplicate pending invitation for the same email and tenant", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const first = await createFacilityInvitation({ tenantId: "lab-1", email: "dup@example.test", fullName: "Dup Person", role: "lab_tech", actorId: "admin-1" })
    expect(first.ok).toBe(true)
    const second = await createFacilityInvitation({ tenantId: "lab-1", email: "dup@example.test", fullName: "Dup Person", role: "lab_tech", actorId: "admin-1" })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe("INVITE_ALREADY_PENDING")
  })

  it("rejects invitations for a department outside the facility", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "x@example.test", fullName: "X Person", role: "lab_tech", departmentId: "dept-other", actorId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("DEPARTMENT_OUT_OF_SCOPE")
  })

  it("redeems a valid invitation exactly once, creating membership via staff_scope_assignments", async () => {
    const { createFacilityInvitation, redeemFacilityInvitation } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "redeem@example.test", fullName: "Redeem Person", role: "lab_tech", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const first = await redeemFacilityInvitation(created.token, "supersecret1")
    expect(first.ok).toBe(true)

    const scopes = fakeDb.__tables.staff_scope_assignments
    expect(scopes).toHaveLength(1)
    expect(scopes[0].tenant_id).toBe("lab-1")
    expect(scopes[0].is_active).toBe(true)

    // Retry-safe / single-use: a second redemption of the same token must not
    // create a second profile or a second scope assignment.
    const second = await redeemFacilityInvitation(created.token, "supersecret1")
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe("INVITE_ALREADY_USED")

    expect(fakeDb.__tables.profiles).toHaveLength(1)
  })

  it("rejects redemption of an expired invitation", async () => {
    const { createFacilityInvitation, redeemFacilityInvitation } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "exp@example.test", fullName: "Expired Person", role: "lab_tech", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    fakeDb.__tables.facility_invitations[0].expires_at = new Date(Date.now() - 1000).toISOString()

    const result = await redeemFacilityInvitation(created.token, "supersecret1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_EXPIRED")
  })

  it("rejects redemption of a revoked invitation", async () => {
    const { createFacilityInvitation, redeemFacilityInvitation } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "rev@example.test", fullName: "Revoked Person", role: "lab_tech", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    fakeDb.__tables.facility_invitations[0].status = "REVOKED"

    const result = await redeemFacilityInvitation(created.token, "supersecret1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_REVOKED")
  })

  it("rejects redemption for an identity already scoped to another facility, without creating a duplicate scope", async () => {
    const { createFacilityInvitation, redeemFacilityInvitation } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "conflict@example.test", fullName: "Conflict Person", role: "lab_tech", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    fakeDb.__tables.profiles.push({ id: "existing-2", email: "conflict@example.test", tenant_id: "another-facility" })

    const result = await redeemFacilityInvitation(created.token, "supersecret1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("IDENTITY_SCOPE_CONFLICT")

    expect(fakeDb.__tables.staff_scope_assignments).toHaveLength(0)
  })

  it("rejects an unknown token", async () => {
    const { redeemFacilityInvitation } = await import("./facility-invitations.server")
    const result = await redeemFacilityInvitation("not-a-real-token", "supersecret1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_NOT_FOUND")
  })
})
