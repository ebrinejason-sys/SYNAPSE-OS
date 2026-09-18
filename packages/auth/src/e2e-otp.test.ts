import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  E2E_ROLE_EMAILS,
  assertE2eSeedAllowed,
  isE2eAllowlistedEmail,
  resolveE2eOtp,
  shouldSkipOtpEmailDelivery,
} from "./e2e-otp.ts"
import { otpCreatePolicy } from "./otp.ts"

describe("E2E OTP policy", () => {
  it("never resolves a fixed OTP in production or without explicit acceptance flags", () => {
    assert.equal(
      resolveE2eOtp(
        { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
        { VERCEL_ENV: "production", SYNAPSE_E2E_AUTH: "true", SYNAPSE_E2E_ACCEPTANCE_ENV: "true", SYNAPSE_E2E_FIXED_OTP: "135790" },
      ),
      null,
    )
    assert.equal(
      resolveE2eOtp(
        { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
        { SYNAPSE_E2E_FIXED_OTP: "135790" },
      ),
      null,
    )
  })

  it("resolves a secret OTP only for allowlisted synthetic E2E users in acceptance", () => {
    const env = {
      SYNAPSE_E2E_AUTH: "true",
      SYNAPSE_E2E_ACCEPTANCE_ENV: "true",
      SYNAPSE_E2E_FIXED_OTP: "135790",
    }
    assert.equal(
      resolveE2eOtp(
        { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
        env,
      ),
      "135790",
    )
    assert.equal(
      resolveE2eOtp(
        { email: "real.user@hospital.ug", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
        env,
      ),
      null,
    )
    assert.equal(
      resolveE2eOtp(
        { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "other-hospital" },
        env,
      ),
      null,
    )
  })

  it("skips Resend only for allowlisted E2E inboxes, not every synthetic tenant", () => {
    assert.equal(shouldSkipOtpEmailDelivery({ isSyntheticTenant: true, email: "a@example.com" }), false)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "reception.e2e@synapseos.invalid" }), true)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "clinician@hospital.ug" }), false)
    assert.equal(isE2eAllowlistedEmail("admin.e2e@synapseos.invalid"), true)
  })

  it("rejects seed unless the exact synthetic slugs are used", () => {
    assert.throws(() => assertE2eSeedAllowed({ seedFlag: "true", slugA: "main-hospital", slugB: "synapse-e2e-hospital-b" }))
    assert.doesNotThrow(() => assertE2eSeedAllowed({
      seedFlag: "true",
      slugA: "synapse-e2e-hospital",
      slugB: "synapse-e2e-hospital-b",
    }))
  })

  it("does not bypass OTP rate limits unless a protected E2E OTP was resolved", () => {
    const denied = otpCreatePolicy(
      { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
      {},
    )
    assert.equal(denied.bypassHourlyLimit, false)
    assert.equal(denied.replaceUnusedRows, false)
    assert.equal(denied.otpOverride, null)

    const allowed = otpCreatePolicy(
      { email: "reception.e2e@synapseos.invalid", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" },
      { SYNAPSE_E2E_AUTH: "true", SYNAPSE_E2E_ACCEPTANCE_ENV: "true", SYNAPSE_E2E_FIXED_OTP: "135790" },
    )
    assert.equal(allowed.bypassHourlyLimit, true)
    assert.equal(allowed.replaceUnusedRows, true)
    assert.equal(allowed.otpOverride, "135790")
  })

  it("uses distinct E2E emails per role so Golden Journey logins do not share an OTP bucket", () => {
    const emails = Object.values(E2E_ROLE_EMAILS)
    assert.equal(new Set(emails).size, emails.length)
  })
})
