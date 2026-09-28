import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { auditLogInsertPayload, phiAccessInsertPayload, phiAccessFkFallback } from "./audit-payload.ts"

// Real columns (prod == repo migrations, verified 2026-09-28):
const AUDIT_LOG_COLUMNS = new Set(["id", "table_name", "action", "record_id", "user_id", "user_role", "old_value", "new_value", "created_at", "tenant_id", "updated_at", "created_by", "is_deleted"])
const PHI_ACCESS_LOG_COLUMNS = new Set(["id", "hospital_id", "actor_id", "actor_role", "patient_id", "access_type", "resource_type", "resource_id", "ip_address", "user_agent", "api_endpoint", "purpose", "accessed_at", "tenant_id", "created_at", "updated_at", "created_by", "is_deleted"])
const A = "11111111-1111-4111-8111-111111111111"
const T = "22222222-2222-4222-8222-222222222222"
const P = "33333333-3333-4333-8333-333333333333"

describe("auditLogInsertPayload", () => {
  it("only writes columns that exist on public.audit_log (PERSON_REGISTER used to fail with PGRST204 actor_id)", () => {
    const row = auditLogInsertPayload({ actor_id: A, actor_email: "a@example.test", action: "PERSON_REGISTER", resource_type: "person", resource_id: P, tenant_id: T, after_state: { synapse_id: "SYN-1" }, app_surface: "web" })
    for (const key of Object.keys(row)) assert.ok(AUDIT_LOG_COLUMNS.has(key), `unknown audit_log column ${key}`)
    assert.equal(row.user_id, A)
    assert.equal(row.table_name, "person")
    assert.equal(row.record_id, P)
    assert.equal(row.tenant_id, T)
    assert.equal(row.action, "PERSON_REGISTER")
    assert.equal((row.new_value as Record<string, unknown>).synapse_id, "SYN-1")
    assert.equal(((row.new_value as Record<string, unknown>)._audit as Record<string, unknown>).actor_email, "a@example.test")
    assert.ok(!("created_by" in row), "created_by FKs auth.users; never write a profile id there")
  })
  it("keeps a non-uuid actor out of the uuid user_id column", () => {
    const row = auditLogInsertPayload({ actor_id: "system", action: "X", resource_type: "t" })
    assert.equal(row.user_id, null)
    assert.equal(((row.new_value as Record<string, unknown>)._audit as Record<string, unknown>).actor, "system")
  })
})

describe("phiAccessInsertPayload", () => {
  it("maps to phi_access_log columns with a valid access_type", () => {
    const row = phiAccessInsertPayload({ accessor_id: A, accessor_role: "pharmacist", patient_id: P, record_type: "identity_lookup", access_reason: "dispense", tenant_id: T })
    for (const key of Object.keys(row)) assert.ok(PHI_ACCESS_LOG_COLUMNS.has(key), `unknown phi_access_log column ${key}`)
    assert.equal(row.actor_id, A)
    assert.equal(row.actor_role, "pharmacist")
    assert.equal(row.patient_id, P)
    assert.equal(row.resource_id, P)
    assert.equal(row.resource_type, "identity_lookup")
    assert.equal(row.purpose, "dispense")
    assert.ok(["view", "edit", "export", "print", "api"].includes(String(row.access_type)))
  })
  it("FK fallback drops FK columns but keeps the subject in resource_id", () => {
    const row = phiAccessFkFallback(phiAccessInsertPayload({ accessor_id: A, accessor_role: "r", patient_id: P, record_type: "x", tenant_id: T }))
    assert.equal(row.actor_id, null)
    assert.equal(row.patient_id, null)
    assert.equal(row.resource_id, P)
    assert.equal(row.tenant_id, T)
  })
})
