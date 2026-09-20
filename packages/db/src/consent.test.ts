import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  consentTemplateFor,
  grantConsent,
  hashConsentTemplate,
  hasPurposeConsent,
  withdrawConsent,
} from "./consent.ts"

describe("consent centre", () => {
  it("grants a versioned country-pack consent without embedding legal statute text", () => {
    const granted = grantConsent({
      personId: "person-1",
      purpose: "blood_transfusion",
      countryPack: "ug-moh-pack",
      signerRelationship: "self",
      captureMethod: "electronic_ack",
      collectedBy: "staff-1",
      scopeFacilityId: "fac-1",
    })
    const template = consentTemplateFor("blood_transfusion", "ug-moh-pack")
    assert.equal(granted.status, "granted")
    assert.equal(granted.contentHash, hashConsentTemplate(template))
    assert.equal(template.legalTextSource, "country_pack")
    assert.doesNotMatch(JSON.stringify(granted), /I hereby consent|statute|Act of Parliament/i)
    assert.equal(hasPurposeConsent([granted], "person-1", "blood_transfusion", "fac-1"), true)
  })

  it("withdraws without deleting the original grant", () => {
    const granted = grantConsent({
      personId: "person-1",
      purpose: "research",
      signerRelationship: "guardian",
      captureMethod: "paper_scan",
      collectedBy: "staff-1",
    })
    const withdrawn = withdrawConsent(granted, { actorId: "staff-1" })
    assert.equal(withdrawn.status, "withdrawn")
    assert.ok(withdrawn.grantedAt)
    assert.ok(withdrawn.withdrawnAt)
    assert.equal(withdrawn.id, granted.id)
    assert.equal(hasPurposeConsent([withdrawn], "person-1", "research"), false)
    assert.throws(() => withdrawConsent(withdrawn, { actorId: "staff-1" }), /CONSENT_ALREADY_WITHDRAWN/)
  })

  it("rejects unknown country packs instead of falling back to a hardcoded jurisdiction", () => {
    assert.throws(() => consentTemplateFor("surgery", "made-up-pack"), /CONSENT_TEMPLATE_UNKNOWN/)
  })
})
