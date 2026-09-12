import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runClinicalOfflinePrescribeGolden } from "./clinical-offline-prescribe.ts"

describe("clinical-offline-prescribe", () => {
  it("queues, applies, replays, conflicts, and rejects signed encounters", async () => {
    const result = await runClinicalOfflinePrescribeGolden({
      encounterId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.aggregate?.prescriptions[0]?.medicationDisplay, "Amoxicillin 500mg")
  })
})
