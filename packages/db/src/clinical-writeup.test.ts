import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  composeClinicalNote,
  mergeWriteupIntoMetadata,
  normalizeClinicalWriteup,
  writeupCompleteness,
  writeupFromEncounterMetadata,
} from "./clinical-writeup"

describe("clinical-writeup", () => {
  it("normalizes and truncates fields", () => {
    const w = normalizeClinicalWriteup({ hpi: "fever", extra: "x" } as never)
    assert.equal(w.hpi, "fever")
    assert.equal(w.plan, "")
  })

  it("reads writeup from encounter metadata", () => {
    const w = writeupFromEncounterMetadata({ writeup: { hpi: "cough", plan: "rest" } })
    assert.equal(w.hpi, "cough")
    assert.equal(w.plan, "rest")
  })

  it("merges writeup without wiping other metadata keys", () => {
    const next = mergeWriteupIntoMetadata({ triage: { esi: 3 } }, normalizeClinicalWriteup({ assessment: "URI" }))
    assert.deepEqual(next.triage, { esi: 3 })
    assert.equal((next.writeup as { assessment: string }).assessment, "URI")
  })

  it("composes a signed-ready clinical note", () => {
    const note = composeClinicalNote(
      normalizeClinicalWriteup({ hpi: "2d fever", examination: "alert", assessment: "viral", plan: "supportive" }),
      "Fever",
    )
    assert.match(note, /Chief complaint\nFever/)
    assert.match(note, /HPI\n2d fever/)
    assert.match(note, /Plan\nsupportive/)
  })

  it("reports completeness", () => {
    const c = writeupCompleteness(normalizeClinicalWriteup({ hpi: "x", plan: "y" }))
    assert.equal(c.filled, 2)
    assert.equal(c.total, 9)
    assert.ok(c.missing.includes("Examination"))
  })
})
