import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldSkipOtpEmailDelivery } from "./synthetic-otp.ts"

describe("shouldSkipOtpEmailDelivery", () => {
  it("skips synthetic tenants and reserved e2e inboxes", () => {
    assert.equal(shouldSkipOtpEmailDelivery({ isSyntheticTenant: true, email: "a@example.com" }), true)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "e2e.receptionist@synapseos.invalid" }), true)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "nurse@facility.synapseos.test" }), true)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "real.user@hospital.ug" }), false)
  })
})
