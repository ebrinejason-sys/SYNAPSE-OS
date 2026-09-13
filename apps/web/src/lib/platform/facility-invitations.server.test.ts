import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

/**
 * Minimal in-memory Supabase-query-builder fake supporting the chains used by
 * facility-invitations.server.ts: select/eq/in/limit, maybeSingle/single,
 * insert(...).select(...).single()/maybeSingle(), update(...), and a fake
 * .rpc(name, args) that dispatches to hand-written JS mirrors of the two
 * Postgres acceptance functions so business-logic branches (wrong recipient,
 * already-used, department revalidation, etc.) are exercised without a real
 * database. Real transactional/concurrency/RLS guarantees are proven
 * separately by the isolated DB-backed integration test
 * (facility-invitations.integration.test.ts), which this suite cannot and
 * does not claim to cover.
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
        if (table === "facility_invitations" && schemaBroken.value && /token_hash|redeemed_by|department_id/.test(cols)) {
          builder.__forceError = "column facility_invitations.token_hash does not exist"
        }
        if (table === "facility_invitation_audit" && schemaBroken.value) {
          builder.__forceError = "relation facility_invitation_audit does not exist"
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

  /** Hand-rolled mirror of the plpgsql acceptance functions, for fast unit coverage only. */
  function rpc(name: string, args: Record<string, unknown>) {
    const invites = tables.facility_invitations ?? (tables.facility_invitations = [])
    const profiles = tables.profiles ?? (tables.profiles = [])
    const scopes = tables.staff_scope_assignments ?? (tables.staff_scope_assignments = [])
    const audit = tables.facility_invitation_audit ?? (tables.facility_invitation_audit = [])
    const departments = tables.departments ?? (tables.departments = [])

    const invite = invites.find((r) => r.token_hash === args.p_token_hash)
    const fail = (code: string) => ({ data: null, error: { message: code } })

    if (!invite) return Promise.resolve(fail("INVITE_NOT_FOUND"))
    if (invite.status === "REVOKED") return Promise.resolve(fail("INVITE_REVOKED"))
    if (invite.status === "ACCEPTED") return Promise.resolve(fail("INVITE_ALREADY_USED"))
    if (new Date(invite.expires_at as string) < new Date()) {
      invite.status = "EXPIRED"
      return Promise.resolve(fail("INVITE_EXPIRED"))
    }
    if (!["PENDING", "SENT"].includes(invite.status as string)) return Promise.resolve(fail("INVITE_ALREADY_USED"))

    if (invite.department_id && !departments.some((d) => d.id === invite.department_id && d.tenant_id === invite.tenant_id)) {
      return Promise.resolve(fail("DEPARTMENT_OUT_OF_SCOPE"))
    }

    if (name === "accept_facility_invitation_existing_user") {
      const profile = profiles.find((p) => p.id === args.p_session_profile_id)
      if (!profile) return Promise.resolve(fail("PROFILE_NOT_FOUND"))
      if (String(profile.email).toLowerCase() !== String(invite.email).toLowerCase()) {
        return Promise.resolve(fail("WRONG_RECIPIENT"))
      }
      const exists = scopes.find((s) => s.profile_id === profile.id && s.tenant_id === invite.tenant_id && s.department_id === invite.department_id && s.is_active)
      if (!exists) scopes.push({ profile_id: profile.id, tenant_id: invite.tenant_id, role: invite.role, department_id: invite.department_id ?? null, is_active: true })

      invite.status = "ACCEPTED"
      invite.redeemed_by = profile.id
      invite.profile_id = profile.id
      audit.push({ invitation_id: invite.id, event: "ACCEPTED_EXISTING_USER" })
      return Promise.resolve({ data: { profile_id: profile.id, tenant_id: invite.tenant_id }, error: null })
    }

    if (name === "accept_facility_invitation_new_account") {
      const existing = profiles.find((p) => String(p.email).toLowerCase() === String(invite.email).toLowerCase())
      if (existing) return Promise.resolve(fail("IDENTITY_EXISTS"))

      profiles.push({
        id: args.p_profile_id,
        email: invite.email,
        full_name: args.p_full_name,
        role: invite.role,
        tenant_id: invite.tenant_id,
        password_hash: args.p_password_hash,
        must_change_password: false,
        onboarding_complete: false,
        verification_status: "pending",
      })
      scopes.push({ profile_id: args.p_profile_id, tenant_id: invite.tenant_id, role: invite.role, department_id: invite.department_id ?? null, is_active: true })
      invite.status = "ACCEPTED"
      invite.redeemed_by = args.p_profile_id
      invite.profile_id = args.p_profile_id
      audit.push({ invitation_id: invite.id, event: "ACCEPTED_NEW_ACCOUNT" })
      return Promise.resolve({ data: { profile_id: args.p_profile_id, tenant_id: invite.tenant_id }, error: null })
    }

    return Promise.resolve(fail("UNKNOWN_RPC"))
  }

  return {
    from: (table: string) => query(table),
    rpc,
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
    facility_invitation_audit: [],
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
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "new@example.test", fullName: "New Person", role: "lab_scientist", actorId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("SCHEMA_INCOMPATIBLE")
  })

  it("creates an invitation with a fresh identity, storing only a token hash and the invited department", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "new@example.test", fullName: "New Person", role: "lab_scientist", departmentId: "dept-1", actorId: "admin-1" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.token).toBeTruthy()
    const rows = fakeDb.__tables.facility_invitations
    expect(rows).toHaveLength(1)
    expect(rows[0].invite_token).toBeNull()
    expect(rows[0].department_id).toBe("dept-1")
    expect(rows[0].token_hash).not.toBe(result.token)
    expect(String(rows[0].token_hash)).not.toContain(result.token)
  })

  it("allows invitation creation for an existing identity at an additional facility", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    fakeDb.__tables.profiles.push({ id: "existing-1", email: "taken@example.test", tenant_id: "other-tenant" })
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "taken@example.test", fullName: "Taken Person", role: "lab_scientist", actorId: "admin-1" })
    expect(result.ok).toBe(true)
  })

  it("rejects a duplicate pending invitation for the same email and tenant", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const first = await createFacilityInvitation({ tenantId: "lab-1", email: "dup@example.test", fullName: "Dup Person", role: "lab_scientist", actorId: "admin-1" })
    expect(first.ok).toBe(true)
    const second = await createFacilityInvitation({ tenantId: "lab-1", email: "dup@example.test", fullName: "Dup Person", role: "lab_scientist", actorId: "admin-1" })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe("INVITE_ALREADY_PENDING")
  })

  it("rejects invitations for a department outside the facility", async () => {
    const { createFacilityInvitation } = await import("./facility-invitations.server")
    const result = await createFacilityInvitation({ tenantId: "lab-1", email: "x@example.test", fullName: "X Person", role: "lab_scientist", departmentId: "dept-other", actorId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("DEPARTMENT_OUT_OF_SCOPE")
  })

  it("registers a new account exactly once, never marking onboarding complete", async () => {
    const { createFacilityInvitation, registerFacilityInvitationNewAccount } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "redeem@example.test", fullName: "Redeem Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const first = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(first.ok).toBe(true)

    const scopes = fakeDb.__tables.staff_scope_assignments
    expect(scopes).toHaveLength(1)
    expect(scopes[0].tenant_id).toBe("lab-1")
    expect(scopes[0].is_active).toBe(true)

    const profile = fakeDb.__tables.profiles[0]
    expect(profile.onboarding_complete).toBe(false)
    expect(profile.verification_status).toBe("pending")

    // Single-use, retry-safe: a second acceptance of the same token must not
    // create a second profile or a second scope assignment.
    const second = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe("INVITE_ALREADY_USED")

    expect(fakeDb.__tables.profiles).toHaveLength(1)
  })

  it("rejects new-account registration when an account already exists for the email", async () => {
    const { createFacilityInvitation, registerFacilityInvitationNewAccount } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "already@example.test", fullName: "Already Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    fakeDb.__tables.profiles.push({ id: "existing-2", email: "already@example.test", tenant_id: "lab-1" })

    const result = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("IDENTITY_EXISTS")
  })

  it("accepts for an existing, correctly-authenticated recipient without touching their password", async () => {
    const { createFacilityInvitation, acceptFacilityInvitationForExistingUser } = await import("./facility-invitations.server")
    fakeDb.__tables.profiles.push({ id: "existing-3", email: "member@example.test", tenant_id: null, password_hash: "original-hash" })
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "member@example.test", fullName: "Member Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: "existing-3" })
    expect(result.ok).toBe(true)
    expect(fakeDb.__tables.profiles[0].password_hash).toBe("original-hash")
    expect(hashPassword).not.toHaveBeenCalled()
  })

  it("rejects acceptance by the wrong authenticated recipient", async () => {
    const { createFacilityInvitation, acceptFacilityInvitationForExistingUser } = await import("./facility-invitations.server")
    fakeDb.__tables.profiles.push({ id: "wrong-1", email: "someone-else@example.test", tenant_id: null })
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "victim@example.test", fullName: "Victim Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await acceptFacilityInvitationForExistingUser({ token: created.token, sessionProfileId: "wrong-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("WRONG_RECIPIENT")
    expect(fakeDb.__tables.staff_scope_assignments).toHaveLength(0)
    expect(fakeDb.__tables.facility_invitations[0].status).not.toBe("ACCEPTED")
  })

  it("rejects acceptance of an expired invitation", async () => {
    const { createFacilityInvitation, registerFacilityInvitationNewAccount } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "exp@example.test", fullName: "Expired Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    fakeDb.__tables.facility_invitations[0].expires_at = new Date(Date.now() - 1000).toISOString()

    const result = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_EXPIRED")
  })

  it("rejects acceptance of a revoked invitation", async () => {
    const { createFacilityInvitation, registerFacilityInvitationNewAccount } = await import("./facility-invitations.server")
    const created = await createFacilityInvitation({ tenantId: "lab-1", email: "rev@example.test", fullName: "Revoked Person", role: "lab_scientist", actorId: "admin-1" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    fakeDb.__tables.facility_invitations[0].status = "REVOKED"

    const result = await registerFacilityInvitationNewAccount({ token: created.token, password: "supersecret1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_REVOKED")
  })

  it("rejects an unknown token", async () => {
    const { registerFacilityInvitationNewAccount } = await import("./facility-invitations.server")
    const result = await registerFacilityInvitationNewAccount({ token: "not-a-real-token", password: "supersecret1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("INVITE_NOT_FOUND")
  })

  it("looks up provisioned raw-token invites and treats null password as activation", async () => {
    const { lookupFacilityInvitation } = await import("./facility-invitations.server")
    fakeDb.__tables.tenants.push({ id: "hosp-1", name: "Synapsetest", facility_type: "hospital" })
    fakeDb.__tables.profiles.push({ id: "prov-1", email: "admin@example.test", tenant_id: "hosp-1", password_hash: null })
    fakeDb.__tables.facility_invitations.push({
      id: "inv-raw-1",
      tenant_id: "hosp-1",
      email: "admin@example.test",
      full_name: "Admin Person",
      role: "hospital_admin",
      invite_token: "raw-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      token_hash: null,
      status: "SENT",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      profile_id: "prov-1",
      tenants: { name: "Synapsetest" },
    })

    const missing = await lookupFacilityInvitation("missing-token")
    expect(missing.ok).toBe(false)

    const found = await lookupFacilityInvitation("raw-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(found.ok).toBe(true)
    if (!found.ok) return
    expect(found.storage).toBe("invite_token")
    expect(found.hasExistingAccount).toBe(false)
    expect(found.email).toBe("admin@example.test")
  })

  it("activates a provisioned raw-token invite by setting the pre-created profile password", async () => {
    const { redeemFacilityInvitation } = await import("./facility-invitations.server")
    fakeDb.__tables.tenants.push({ id: "hosp-1", name: "Synapsetest", facility_type: "hospital" })
    fakeDb.__tables.profiles.push({ id: "prov-1", email: "admin@example.test", tenant_id: "hosp-1", password_hash: null })
    fakeDb.__tables.facility_invitations.push({
      id: "inv-raw-2",
      tenant_id: "hosp-1",
      email: "admin@example.test",
      full_name: "Admin Person",
      role: "hospital_admin",
      invite_token: "raw-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      token_hash: null,
      status: "SENT",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      profile_id: "prov-1",
      tenants: { name: "Synapsetest" },
    })

    const result = await redeemFacilityInvitation({
      token: "raw-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      password: "supersecret1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profileId).toBe("prov-1")
    expect(fakeDb.__tables.profiles[0].password_hash).toBeTruthy()
    expect(fakeDb.__tables.facility_invitations[0].status).toBe("ACCEPTED")
    expect(fakeDb.__tables.staff_scope_assignments.some((s: { tenant_id: string }) => s.tenant_id === "hosp-1")).toBe(true)
  })
})

