import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runHospitalCloseoutGoldenJourney } from "./hospital-closeout-golden.ts"

describe("hospital-closeout-golden", () => {
  it("walks billing → disposition → close in order", () => {
    const result = runHospitalCloseoutGoldenJourney({ correlationId: "test-closeout" })
    assert.equal(result.ok, true)
    assert.equal(result.steps[0]?.step, "INVOICE_OUTSTANDING")
    assert.equal(result.steps[0]?.decision.ok, false)
    assert.equal(result.steps[1]?.decision.ok, false)
    assert.equal(result.steps[2]?.decision.ok, true)
    assert.equal(result.final.ok, true)
    assert.equal(result.correlationId, "test-closeout")
  })
})
