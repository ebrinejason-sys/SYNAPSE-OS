import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  blockingLocalPharmacyPrescriptions,
  evaluateEncounterCloseGate,
} from "./encounter-close-gate.ts"

describe("evaluateEncounterCloseGate", () => {
  it("allows close when clinical and financial work is clear", () => {
    const decision = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "in_progress",
      invoice: { id: "inv-1", status: "paid", totalAmount: 100, paidAmount: 100 },
    })
    assert.deepEqual(decision, { ok: true })
  })

  it("returns alreadyClosed when status is completed", () => {
    const decision = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "completed",
    })
    assert.equal(decision.ok, true)
    if (decision.ok) assert.equal(decision.alreadyClosed, true)
  })

  it("blocks on open lab, unreviewed results, pharmacy, billing, and tasks", () => {
    assert.equal(
      evaluateEncounterCloseGate({
        encounterExists: true,
        hospitalMatches: true,
        status: "open",
        openLabOrderIds: ["lab-1"],
      }).ok,
      false,
    )
    assert.equal(
      evaluateEncounterCloseGate({
        encounterExists: true,
        hospitalMatches: true,
        status: "open",
        unreviewedFinalResultIds: ["res-1"],
      }).ok,
      false,
    )
    assert.equal(
      evaluateEncounterCloseGate({
        encounterExists: true,
        hospitalMatches: true,
        status: "open",
        blockingActivePrescriptionIds: ["rx-1"],
      }).ok,
      false,
    )
    const billing = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "open",
      invoice: { id: "inv-2", status: "issued", totalAmount: 50, paidAmount: 10 },
    })
    assert.equal(billing.ok, false)
    if (!billing.ok) assert.equal(billing.blocking, "BILLING")
    const task = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "open",
      pendingTask: { id: "t-1", taskType: "consultation" },
    })
    assert.equal(task.ok, false)
    if (!task.ok) assert.equal(task.blocking, "TASK")
  })

  it("treats EXTERNAL_PHARMACY / NO_MEDICATION active rows as non-blocking", () => {
    const ids = blockingLocalPharmacyPrescriptions([
      { id: "a", status: "active", disposition: "EXTERNAL_PHARMACY" },
      { id: "b", status: "active", disposition: null },
      { id: "c", status: "dispensed", disposition: null },
      { id: "d", status: "active", disposition: "NO_MEDICATION" },
    ])
    assert.deepEqual(ids, ["b"])
  })
})
