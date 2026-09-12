import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { measureLabTatMs, runLabGoldenJourney } from "./lab-golden-journey.ts"

describe("lab-golden-journey", () => {
  it("passes specimen reject → recollect → release → amend + printable reports with TAT", () => {
    const result = runLabGoldenJourney({
      correlationId: "lab-golden-corr-1",
      scientistId: "scientist-human-1",
    })
    assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => s.status === "FAIL"), null, 2))
    assert.equal(result.correlationId, "lab-golden-corr-1")
    assert.equal(result.rejectedOrder?.status, "REJECTED")
    assert.equal(result.rejectedOrder?.rejectionReason, "hemolyzed")
    assert.equal(result.releasedOrder?.status, "AMENDED")
    assert.equal(result.amendment?.previousValue, "Negative")
    assert.equal(result.amendment?.newValue, "Positive")
    assert.equal(result.finalReport?.status, "FINAL")
    assert.equal(result.amendedReport?.status, "AMENDED")
    assert.notEqual(result.finalReport?.contentHash, result.amendedReport?.contentHash)
    assert.equal(result.tat?.orderToReleaseMs, 75 * 60_000)
    const ids = result.steps.map((s) => s.id)
    assert.ok(ids.includes("specimen_rejected"))
    assert.ok(ids.includes("recollect_replacement_order"))
    assert.ok(ids.includes("tat_measured"))
    assert.ok(ids.includes("amended_report"))
    assert.ok(ids.includes("ai_cannot_verify"))
    assert.ok(ids.includes("result_locked_refuses_overwrite"))
  })

  it("measureLabTatMs rejects inverted timestamps", () => {
    assert.throws(
      () =>
        measureLabTatMs({
          orderedAt: "2026-09-12T12:00:00.000Z",
          releasedAt: "2026-09-12T11:00:00.000Z",
        }),
      /LAB_TAT_INVALID_TIMESTAMPS/,
    )
  })
})
