import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { InvalidIdentifierError, optionalUuid, requireTenantId, requireUuid } from "./identifiers.ts"

describe("identifier guards", () => {
  it("accepts a well-formed UUID", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    assert.equal(requireUuid(id, "tenant_id"), id)
    assert.equal(requireTenantId(id), id)
  })

  it("rejects missing tenant identifiers instead of sending them to Postgres", () => {
    for (const value of [undefined, null, "", "undefined", "null", "not-a-uuid"]) {
      assert.throws(() => requireTenantId(value), InvalidIdentifierError)
      assert.throws(() => requireUuid(value, "tenant_id"), (err: unknown) => {
        assert.ok(err instanceof InvalidIdentifierError)
        assert.equal(err.field, "tenant_id")
        assert.equal(err.message, "INVALID_IDENTIFIER:tenant_id")
        return true
      })
    }
  })

  it("optional UUID treats empty as null and still rejects the string undefined", () => {
    assert.equal(optionalUuid(undefined, "person_id"), null)
    assert.equal(optionalUuid(null, "person_id"), null)
    assert.equal(optionalUuid("", "person_id"), null)
    assert.throws(() => optionalUuid("undefined", "person_id"), InvalidIdentifierError)
  })
})
