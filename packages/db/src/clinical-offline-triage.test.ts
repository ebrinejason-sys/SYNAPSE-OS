import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runClinicalOfflineTriageGolden, vitalsInsertFromTriage } from "./clinical-offline-triage.ts"

describe("clinical-offline-triage", () => {
  it("queues, applies, replays, conflicts, and rejects signed encounters", async () => {
    const result = await runClinicalOfflineTriageGolden({
      encounterId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.aggregate?.clinicalStage, "YELLOW")
  })

  it("stamps a stable server outbox id for retry upserts", () => {
    const outboxId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const row = vitalsInsertFromTriage({
      tenantId: "tenant-1",
      encounterId: "enc-1",
      actorId: "nurse-1",
      id: outboxId,
      triage: { temperature_c: 38.4, clinical_stage: "YELLOW" },
    })
    assert.equal(row.id, outboxId)
    assert.equal(row.encounter_id, "enc-1")
    assert.equal(row.temperature_c, 38.4)
  })
})
