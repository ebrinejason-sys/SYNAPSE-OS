import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  blockingLocalPharmacyPrescriptions,
  evaluateEncounterCloseGate,
} from "./encounter-close-gate.ts"

describe("evaluateEncounterCloseGate", () => {
  it("allows close when clinical, financial, and disposition work is clear", () => {
    const decision = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "in_progress",
      disposition: "CLINICAL_COMPLETE",
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

  it("blocks when disposition is missing even if billing is paid", () => {
    const decision = evaluateEncounterCloseGate({
      encounterExists: true,
      hospitalMatches: true,
      status: "in_progress",
      disposition: null,
      invoice: { id: "inv-1", status: "paid", totalAmount: 100, paidAmount: 100 },
    })
    assert.equal(decision.ok, false)
    if (!decision.ok) assert.equal(decision.blocking, "DISPOSITION")
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
    assert.equal(
      evaluateEncounterCloseGate({
        encounterExists: true,
        hospitalMatches: true,
        status: "open",
        disposition: "FOLLOW_UP",
        invoice: { id: "inv-1", status: "issued", totalAmount: 100, paidAmount: 0 },
      }).ok,
      false,
    )
    assert.equal(
      evaluateEncounterCloseGate({
        encounterExists: true,
        hospitalMatches: true,
        status: "open",
        disposition: "FOLLOW_UP",
        invoice: { id: "inv-1", status: "paid", totalAmount: 100, paidAmount: 100 },
        pendingTask: { id: "t-1", taskType: "FOLLOW_UP" },
      }).ok,
      false,
    )
  })

  it("filters local-pharmacy blockers from prescription rows", () => {
    const ids = blockingLocalPharmacyPrescriptions([
      { id: "a", status: "active", disposition: "EXTERNAL_PHARMACY" },
      { id: "b", status: "active", disposition: null },
      { id: "c", status: "dispensed", disposition: null },
      { id: "d", status: "active", disposition: "NO_MEDICATION" },
    ])
    assert.deepEqual(ids, ["b"])
  })
})
