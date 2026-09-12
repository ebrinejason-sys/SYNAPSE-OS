import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runHospitalGoldenJourney } from "./hospital-golden-journey.ts"

describe("hospital-golden-journey", () => {
  it("passes reception → write-up → pharmacy → closeout", () => {
    const result = runHospitalGoldenJourney({
      chiefComplaint: "fever",
      quantity: 6,
      availableStock: 20,
      consultationFee: 15000,
    })
    assert.equal(result.status, "PASS", JSON.stringify(result.steps, null, 2))
    assert.ok(result.correlationId)
    assert.ok(result.clinicalNote?.includes("HPI"))
    assert.equal(result.remainingStock, 14)
    const ids = result.steps.map((s) => s.id)
    for (const required of [
      "reception_encounter_opened",
      "nurse_triage_completed",
      "doctor_writeup",
      "encounter_signed",
      "prescription_placed",
      "prescription_verified",
      "prescription_dispensed",
      "stock_decrement",
      "closeout_billing_blocks",
      "closeout_disposition_required",
      "encounter_close_allowed",
    ]) {
      assert.ok(ids.includes(required), `missing step ${required}`)
    }
    assert.ok(result.steps.every((s) => s.status === "PASS"))
    assert.ok(!ids.includes("lab_order_to_release"))
  })

  it("keeps one correlation id across the journey", () => {
    const encounterId = "11111111-1111-4111-8111-111111111111"
    const result = runHospitalGoldenJourney({ encounterId })
    assert.equal(result.status, "PASS")
    assert.equal(result.correlationId, encounterId)
  })

  it("optional lab branch blocks close until review then continues", () => {
    const result = runHospitalGoldenJourney({
      includeLab: true,
      quantity: 3,
      availableStock: 10,
    })
    assert.equal(result.status, "PASS", JSON.stringify(result.steps, null, 2))
    const ids = result.steps.map((s) => s.id)
    assert.ok(ids.includes("lab_order_to_release"))
    assert.ok(ids.includes("lab_doctor_review"))
    assert.ok(ids.includes("encounter_close_allowed"))
  })
})
