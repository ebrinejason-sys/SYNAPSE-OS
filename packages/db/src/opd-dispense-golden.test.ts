import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runOpdDispenseGoldenJourney } from "./opd-dispense-golden.ts"

describe("opd-dispense golden journey", () => {
  it("passes encounter → triage → prescribe → verify → dispense with stock decrement", () => {
    const result = runOpdDispenseGoldenJourney({ quantity: 5, availableStock: 12 })
    assert.equal(result.status, "PASS", JSON.stringify(result.steps, null, 2))
    assert.equal(result.prescription?.status, "dispensed")
    assert.equal(result.remainingStock, 7)
    assert.equal(result.pharmacyTask?.status, "COMPLETED")
    assert.ok(result.steps.every((step) => step.status === "PASS"))
    assert.deepEqual(
      result.steps.map((step) => step.id),
      [
        "encounter_opened",
        "triage_completed",
        "prescription_placed",
        "tenant_bound",
        "prescription_verified",
        "prescription_dispensed",
        "already_dispensed_guard",
      ],
    )
  })

  it("fails closed on insufficient stock", () => {
    const result = runOpdDispenseGoldenJourney({
      quantity: 10,
      availableStock: 2,
      expectDispenseError: "INSUFFICIENT_STOCK",
    })
    assert.equal(result.status, "PASS", JSON.stringify(result.steps, null, 2))
    const dispense = result.steps.find((step) => step.id === "prescription_dispensed")
    assert.equal(dispense?.status, "PASS")
    assert.equal(dispense?.detail, "INSUFFICIENT_STOCK")
  })

  it("keeps a shared correlation id across the journey", () => {
    const encounterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const result = runOpdDispenseGoldenJourney({ encounterId, quantity: 1, availableStock: 5 })
    assert.equal(result.status, "PASS", JSON.stringify(result.steps, null, 2))
    assert.equal(result.correlationId, encounterId)
    assert.equal(result.prescription?.correlationId, encounterId)
    const events = result.queue?.outbox.list({ correlationId: encounterId }) ?? []
    assert.ok(events.length >= 2)
    assert.ok(events.every((event) => event.correlation_id === encounterId))
  })
})
