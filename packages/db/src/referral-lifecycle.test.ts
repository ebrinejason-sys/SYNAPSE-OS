import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  acceptReferral,
  cancelReferral,
  createFacilityReferral,
  rejectReferral,
  runReferralGoldenJourney,
} from "./referral-lifecycle.ts"

describe("referral-lifecycle", () => {
  it("creates, accepts, and rejects invalid same-facility", () => {
    const ref = createFacilityReferral({
      fromTenantId: "a",
      toTenantId: "b",
      patientId: "p",
      encounterId: "e",
      speciality: "Surgery",
      clinicalSummary: "Acute abdomen",
      createdBy: "doc",
      urgency: "IMMEDIATE",
      consentObtained: true,
    })
    assert.equal(ref.status, "pending")
    const accepted = acceptReferral(ref, { acceptedBy: "recv" })
    assert.equal(accepted.status, "accepted")
    assert.throws(
      () =>
        createFacilityReferral({
          fromTenantId: "a",
          toTenantId: "a",
          patientId: "p",
          encounterId: "e",
          speciality: "Surgery",
          clinicalSummary: "x",
          createdBy: "doc",
        }),
      /REFERRAL_SAME_FACILITY/,
    )
  })

  it("supports reject and cancel from pending", () => {
    const ref = createFacilityReferral({
      fromTenantId: "a",
      toTenantId: "b",
      patientId: "p",
      encounterId: "e",
      speciality: "Paeds",
      clinicalSummary: "Needs NICU",
      createdBy: "doc",
    })
    assert.equal(rejectReferral(ref, { reason: "No capacity" }).status, "rejected")
    assert.equal(cancelReferral(ref).status, "cancelled")
  })

  it("runs referral golden journey", () => {
    const result = runReferralGoldenJourney({ encounterId: "enc-ref-1" })
    assert.equal(result.ok, true, JSON.stringify(result.steps))
    assert.equal(result.correlationId, "enc-ref-1")
    assert.equal(result.referral.status, "completed")
  })
})
