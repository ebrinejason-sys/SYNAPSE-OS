import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isAuthenticatedOsLocation } from "./os-location.ts"

describe("isAuthenticatedOsLocation", () => {
  it("rejects login bounce URLs that merely contain /os/{slug}", () => {
    assert.equal(isAuthenticatedOsLocation("/login?next=/os/synapse-e2e-hospital/dashboard", "synapse-e2e-hospital"), false)
    assert.equal(isAuthenticatedOsLocation("/os/synapse-e2e-hospital/login", "synapse-e2e-hospital"), false)
  })

  it("accepts authenticated facility shell paths", () => {
    assert.equal(isAuthenticatedOsLocation("/os/synapse-e2e-hospital", "synapse-e2e-hospital"), true)
    assert.equal(isAuthenticatedOsLocation("/os/synapse-e2e-hospital/patients", "synapse-e2e-hospital"), true)
  })
})
