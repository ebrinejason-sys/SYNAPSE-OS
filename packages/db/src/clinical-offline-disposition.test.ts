import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runClinicalOfflineDispositionGolden } from "./clinical-offline-disposition.ts"

describe("clinical-offline-disposition", () => {
  it("queues, applies, replays, conflicts, and rejects signed encounters", async () => {
    const result = await runClinicalOfflineDispositionGolden({
      encounterId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.aggregate?.disposition, "CLINICAL_COMPLETE")
  })
})
