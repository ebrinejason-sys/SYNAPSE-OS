import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDispositionSyncCommand,
  isClinicalDisposition,
  runClinicalOfflineDispositionGolden,
} from "./clinical-offline-disposition.ts"

describe("clinical-offline-disposition", () => {
  it("queues, applies, replays, conflicts, and rejects signed encounters", async () => {
    const result = await runClinicalOfflineDispositionGolden({
      encounterId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.aggregate?.disposition, "CLINICAL_COMPLETE")
  })

  it("does not allow DECEASED through generic offline disposition", async () => {
    assert.equal(isClinicalDisposition("DECEASED"), false)
    await assert.rejects(
      () =>
        buildDispositionSyncCommand({
          tenantId: "11111111-1111-4111-8111-111111111111",
          facilityId: "22222222-2222-4222-8222-222222222222",
          deviceId: "33333333-3333-4333-8333-333333333333",
          actorId: "44444444-4444-4444-8444-444444444444",
          encounterId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          disposition: "DECEASED" as never,
        }),
      /DEATH_REQUIRES_PRONOUNCEMENT_COMMAND|INVALID_DISPOSITION/,
    )
  })
})
