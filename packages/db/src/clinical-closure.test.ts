import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveEncounterNextWork } from "./clinical-journey.ts"

describe("encounter next-work resolver", () => {
  it("handles optional branches without inventing Lab or Pharmacy work", () => {
    const result = resolveEncounterNextWork({
      invoice: { status: "paid", totalAmount: 100, paidAmount: 100 },
      labOrders: [],
      prescriptions: [],
      tasks: [],
    })
    assert.equal(result.next, "COMPLETE")
  })

  it("prioritizes released result review before pharmacy and billing", () => {
    const result = resolveEncounterNextWork({
      releasedResults: [{ id: "result-1", reviewed: false }],
      prescriptions: [{ id: "rx-1", status: "active" }],
      invoice: { status: "draft", totalAmount: 100, paidAmount: 0 },
    })
    assert.equal(result.next, "DOCTOR_REVIEW")
    assert.equal(result.sourceId, "result-1")
  })

  it("treats external Pharmacy as complete clinical work", () => {
    const result = resolveEncounterNextWork({
      prescriptions: [{ id: "rx-1", status: "active", localDispense: false }],
      invoice: { status: "paid", totalAmount: 0, paidAmount: 0 },
    })
    assert.equal(result.next, "COMPLETE")
  })
})