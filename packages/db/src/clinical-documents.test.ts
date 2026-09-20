import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  amendClinicalDocument,
  assertDocumentMutable,
  assertSameTenant,
  createClinicalDocument,
  hashDocumentContent,
  signClinicalDocument,
  updateDraftClinicalDocument,
} from "./clinical-documents.ts"

const base = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  facilityId: "22222222-2222-4222-8222-222222222222",
  patientId: "33333333-3333-4333-8333-333333333333",
  authorId: "44444444-4444-4444-8444-444444444444",
  documentType: "REFERRAL_LETTER" as const,
  templateId: "referral.letter.ug",
  templateVersion: "v1",
  structuredPayload: { speciality: "internal medicine", urgency: "URGENT" },
  renderedSnapshot: "Referral letter for Amina Demo",
}

describe("clinical documents engine", () => {
  it("hashes content and starts as a mutable draft", () => {
    const doc = createClinicalDocument(base)
    assert.equal(doc.status, "draft")
    assert.equal(doc.contentHash, hashDocumentContent(base))
    assert.doesNotThrow(() => assertDocumentMutable(doc))
  })

  it("makes a signed document immutable and requires a new version to correct it", () => {
    const signed = signClinicalDocument(createClinicalDocument(base), { signedBy: base.authorId })
    assert.equal(signed.status, "signed")
    assert.throws(() => assertDocumentMutable(signed), /DOCUMENT_IMMUTABLE/)
    assert.throws(() => signClinicalDocument(signed, { signedBy: base.authorId }), /DOCUMENT_ALREADY_SIGNED/)
    const amendment = amendClinicalDocument(signed, {
      authorId: base.authorId,
      structuredPayload: { ...base.structuredPayload, addendum: "Updated vitals" },
      renderedSnapshot: "Referral letter addendum",
    })
    assert.equal(amendment.amendmentOfId, signed.id)
    assert.equal(amendment.supersedesId, signed.id)
    assert.notEqual(amendment.contentHash, signed.contentHash)
    assert.equal(amendment.status, "draft")
  })

  it("binds documents to the authenticated tenant", () => {
    const doc = createClinicalDocument(base)
    assert.doesNotThrow(() => assertSameTenant(doc, base.tenantId))
    assert.throws(() => assertSameTenant(doc, "99999999-9999-4999-8999-999999999999"), /DOCUMENT_TENANT_MISMATCH/)
  })

  it("allows draft updates and refuses them after signature", () => {
    const draft = createClinicalDocument(base)
    const updated = updateDraftClinicalDocument(draft, {
      actorId: base.authorId,
      structuredPayload: { speciality: "surgery" },
      renderedSnapshot: "Updated referral letter",
    })
    assert.notEqual(updated.contentHash, draft.contentHash)
    const signed = signClinicalDocument(updated, { signedBy: base.authorId })
    assert.throws(
      () =>
        updateDraftClinicalDocument(signed, {
          actorId: base.authorId,
          structuredPayload: { speciality: "tamper" },
          renderedSnapshot: "Tampered",
        }),
      /DOCUMENT_IMMUTABLE/,
    )
  })
})
