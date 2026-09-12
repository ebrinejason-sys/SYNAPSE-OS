import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runClinicalOfflineWriteupGolden } from "./clinical-offline-writeup.ts"

describe("clinical-offline-writeup", () => {
  it("queues, applies, replays, and conflicts on hash mismatch", async () => {
    const result = await runClinicalOfflineWriteupGolden({
      encounterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps, null, 2))
    assert.equal(result.correlationId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    assert.ok((result.aggregate?.metadata.writeup as { hpi?: string })?.hpi?.includes("Offline"))
  })
})
