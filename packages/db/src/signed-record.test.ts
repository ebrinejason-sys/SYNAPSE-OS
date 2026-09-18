import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mergeWriteupIntoMetadata, normalizeClinicalWriteup } from "./clinical-writeup.ts"

function signedEncounterGuard(encounter: { is_signed: boolean }, patch: Record<string, unknown>) {
  if (encounter.is_signed && ("clinical_note" in patch || "writeup" in patch || "is_signed" in patch && patch.is_signed === false)) {
    throw new Error("ENCOUNTER_SIGNED_IMMUTABLE")
  }
}

describe("signed clinical record safety", () => {
  it("refuses silent mutation of a signed note", () => {
    assert.throws(
      () => signedEncounterGuard({ is_signed: true }, { clinical_note: "altered after sign" }),
      /ENCOUNTER_SIGNED_IMMUTABLE/,
    )
  })

  it("allows draft mutation and keeps unrelated metadata when merging writeup", () => {
    signedEncounterGuard({ is_signed: false }, { writeup: { hpi: "fever" } })
    const next = mergeWriteupIntoMetadata({ triage: { esi: 3 } }, normalizeClinicalWriteup({ hpi: "fever" }))
    assert.deepEqual(next.triage, { esi: 3 })
  })

  it("does not unsign via payload", () => {
    assert.throws(
      () => signedEncounterGuard({ is_signed: true }, { is_signed: false }),
      /ENCOUNTER_SIGNED_IMMUTABLE/,
    )
  })
})
