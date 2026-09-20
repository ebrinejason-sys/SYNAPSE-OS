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

const RECEPTION = E2E_ROLE_EMAILS.receptionist
const ACCEPTANCE_ENV = {
  SYNAPSE_E2E_AUTH: "true",
  SYNAPSE_E2E_ACCEPTANCE_ENV: "true",
  SYNAPSE_E2E_FIXED_OTP: "135790",
} as const
const SYNTHETIC_RECEPTION = {
  email: RECEPTION,
  isSyntheticTenant: true,
  facilitySlug: "synapse-e2e-hospital",
} as const

describe("E2E OTP policy", () => {
  it("A: production runtime + E2E email => no fixed OTP and email delivery is not skipped", () => {
    const production = {
      ...ACCEPTANCE_ENV,
      VERCEL_ENV: "production",
    }
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, production), null)
    assert.equal(shouldSkipOtpEmailDelivery(SYNTHETIC_RECEPTION, production), false)
  })

  it("B: non-synthetic tenant => no fixed OTP and email delivery is not skipped", () => {
    const input = { ...SYNTHETIC_RECEPTION, isSyntheticTenant: false }
    assert.equal(resolveE2eOtp(input, ACCEPTANCE_ENV), null)
    assert.equal(shouldSkipOtpEmailDelivery(input, ACCEPTANCE_ENV), false)
  })

  it("C: wrong facility slug => fixed OTP denied", () => {
    const input = { ...SYNTHETIC_RECEPTION, facilitySlug: "other-hospital" }
    assert.equal(resolveE2eOtp(input, ACCEPTANCE_ENV), null)
    assert.equal(shouldSkipOtpEmailDelivery(input, ACCEPTANCE_ENV), false)
  })

  it("D: non-allowlisted identity => fixed OTP denied", () => {
    const input = { ...SYNTHETIC_RECEPTION, email: "real.user@hospital.ug" }
    assert.equal(resolveE2eOtp(input, ACCEPTANCE_ENV), null)
    assert.equal(shouldSkipOtpEmailDelivery(input, ACCEPTANCE_ENV), false)
    assert.equal(
      shouldSkipOtpEmailDelivery({ email: "synapseostech@gmail.com", isSyntheticTenant: true, facilitySlug: "synapse-e2e-hospital" }, ACCEPTANCE_ENV),
      false,
    )
  })

  it("E: proper synthetic Preview => fixed OTP works and email may be skipped", () => {
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, ACCEPTANCE_ENV), "135790")
    assert.equal(shouldSkipOtpEmailDelivery(SYNTHETIC_RECEPTION, ACCEPTANCE_ENV), true)
  })

  it("F: VERCEL_ENV=production denies the shortcut regardless of other flags", () => {
    const production = {
      SYNAPSE_E2E_AUTH: "true",
      SYNAPSE_E2E_ACCEPTANCE_ENV: "true",
      SYNAPSE_E2E_FIXED_OTP: "135790",
      VERCEL_ENV: "production",
    }
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, production), null)
    assert.equal(shouldSkipOtpEmailDelivery(SYNTHETIC_RECEPTION, production), false)
  })

  it("does not skip email from an allowlisted address alone", () => {
    assert.equal(shouldSkipOtpEmailDelivery({ email: RECEPTION }), false)
    assert.equal(shouldSkipOtpEmailDelivery({ isSyntheticTenant: true, email: "a@example.com" }), false)
    assert.equal(shouldSkipOtpEmailDelivery({ email: "clinician@hospital.ug" }), false)
    assert.equal(isE2eAllowlistedEmail("admin.e2e@synapseos.invalid"), true)
    assert.equal(isE2eAllowlistedEmail("synapseostech@gmail.com"), false)
  })

  it("never resolves a fixed OTP without explicit acceptance flags", () => {
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, { SYNAPSE_E2E_FIXED_OTP: "135790" }), null)
  })

  it("reads E2E flags through dynamic env keys", () => {
    const env = Object.create(null) as NodeJS.ProcessEnv
    env["SYNAPSE_E2E_AUTH"] = "true"
    env["SYNAPSE_E2E_ACCEPTANCE_ENV"] = "true"
    env["SYNAPSE_E2E_FIXED_OTP"] = "135790"
    env["VERCEL_ENV"] = "preview"
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, env), "135790")
    env["VERCEL_ENV"] = "production"
    assert.equal(resolveE2eOtp(SYNTHETIC_RECEPTION, env), null)
  })

  it("rejects seed unless the exact synthetic slugs are used", () => {
    assert.throws(() => assertE2eSeedAllowed({ seedFlag: "true", slugA: "main-hospital", slugB: "synapse-e2e-hospital-b" }))
    assert.doesNotThrow(() => assertE2eSeedAllowed({
      seedFlag: "true",
      slugA: "synapse-e2e-hospital",
      slugB: "synapse-e2e-hospital-b",
    }))
  })

  it("never bypasses the hourly OTP send cap or deletes unused rows, even for protected E2E OTP", () => {
    const denied = otpCreatePolicy(SYNTHETIC_RECEPTION, {})
    assert.equal(denied.bypassHourlyLimit, false)
    assert.equal(denied.replaceUnusedRows, false)
    assert.equal(denied.otpOverride, null)
    assert.equal(denied.reuseExistingUnused, false)

    const allowed = otpCreatePolicy(SYNTHETIC_RECEPTION, ACCEPTANCE_ENV)
    assert.equal(allowed.bypassHourlyLimit, false)
    assert.equal(allowed.replaceUnusedRows, false)
    assert.equal(allowed.reuseExistingUnused, true)
    assert.equal(allowed.otpOverride, "135790")
  })

  it("uses distinct synthetic E2E emails per role so Golden Journey logins do not share an OTP bucket", () => {
    const emails = Object.values(E2E_ROLE_EMAILS)
    assert.equal(new Set(emails).size, emails.length)
    for (const email of emails) {
      assert.match(email, /@synapseos\.invalid$/)
    }
  })
})
