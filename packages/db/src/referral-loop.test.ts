import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createFacilityReferral } from "./referral-lifecycle.ts"
import {
  advanceReferralLoop,
  buildReferralLetterDocument,
  loopStageFromStoredStatus,
  recordReferralFeedback,
  referralLetterVerificationPayload,
  storedStatusForLoopStage,
} from "./referral-loop.ts"
import { signClinicalDocument } from "./clinical-documents.ts"

describe("referral closed-loop overlay", () => {
  it("derives loop stages from historical stored statuses without rewriting them", () => {
    assert.equal(loopStageFromStoredStatus("pending"), "created")
    assert.equal(loopStageFromStoredStatus("accepted"), "accepted")
    assert.equal(loopStageFromStoredStatus("completed"), "completed")
  })

  it("advances sent → received → accepted without inventing a second referral table", () => {
    const referral = createFacilityReferral({
      fromTenantId: "a",
      toTenantId: "b",
      patientId: "p",
      encounterId: "e",
      speciality: "Medicine",
      clinicalSummary: "Needs higher-level care",
      createdBy: "doc",
    })
    let loop = {
      referralId: referral.id,
      storedStatus: referral.status,
      stage: loopStageFromStoredStatus(referral.status),
    }
    loop = advanceReferralLoop(loop, "sent")
    loop = advanceReferralLoop(loop, "received")
    assert.equal(loop.stage, "received")
    assert.throws(() => advanceReferralLoop(loop, "completed"), /REFERRAL_LOOP_INVALID_TRANSITION/)
  })

  it("builds a referral letter document that does not put PHI in the QR payload", () => {
    const referral = createFacilityReferral({
      fromTenantId: "a",
      toTenantId: "b",
      patientId: "p",
      encounterId: "e",
      speciality: "Medicine",
      clinicalSummary: "Needs higher-level care",
      createdBy: "doc",
      consentObtained: true,
    })
    const letter = buildReferralLetterDocument({
      tenantId: "a",
      facilityId: "fac-a",
      authorId: "doc",
      patientName: "Amina Demo",
      synapseId: "SYN-UG-DEMO-0001",
      referringFacility: "Demo Hospital",
      receivingFacility: "Regional Referral",
      referringClinician: "Dr Demo",
      referral,
    })
    assert.match(letter.renderedSnapshot, /SYN-UG-DEMO-0001/)
    assert.match(letter.renderedSnapshot, /do not encode PHI/i)
    const signed = signClinicalDocument(letter, { signedBy: "doc" })
    assert.equal(signed.status, "signed")
    const qr = referralLetterVerificationPayload(referral.id)
    assert.equal(qr.phi, false)
    assert.equal(qr.id, referral.id)
    assert.doesNotMatch(JSON.stringify(qr), /Amina|SYN-UG-DEMO|Needs higher-level/)
  })

  it("records counter-referral feedback after the patient is seen", () => {
    let loop = {
      referralId: "r1",
      storedStatus: "accepted" as const,
      stage: "seen" as const,
    }
    loop = recordReferralFeedback(loop, { feedback: "Stabilised; follow-up in OPD", counterReferralId: "r2" })
    assert.equal(loop.stage, "feedback_returned")
    assert.equal(storedStatusForLoopStage(loop.stage), "accepted")
    assert.equal(loop.counterReferralId, "r2")
  })
})
