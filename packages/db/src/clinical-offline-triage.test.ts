import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runClinicalOfflineTriageGolden } from "./clinical-offline-triage.ts"

describe("clinical-offline-triage", () => {
  it("queues, applies, replays, conflicts, and rejects signed encounters", async () => {
    const result = await runClinicalOfflineTriageGolden({
      encounterId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.aggregate?.clinicalStage, "YELLOW")
  })
})
