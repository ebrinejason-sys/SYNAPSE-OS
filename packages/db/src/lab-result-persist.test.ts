import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { persistableLabResultStatus, labResultToRow, rowToLabResult } from "./lab-result-persist.ts"

describe("lab-result-persist", () => {
  it("maps amended workflow status to corrected DB status", () => {
    assert.equal(persistableLabResultStatus("amended"), "corrected")
    assert.equal(persistableLabResultStatus("final"), "final")
    assert.equal(persistableLabResultStatus("preliminary"), "preliminary")
  })

  it("round-trips amended via corrected column", () => {
    const row = labResultToRow({
      id: "r1",
      labOrderId: "o1",
      tenantId: "t1",
      patientId: "p1",
      loincCode: "58413-6",
      testName: "Malaria",
      resultValue: "Positive",
      numericValue: null,
      unit: "",
      referenceRange: "negative",
      flag: "A",
      isCritical: false,
      isAbnormal: true,
      status: "amended",
      version: 2,
      provenance: "LAB_VERIFIED",
      isSynthetic: false,
    })
    assert.equal(row.status, "corrected")
    const back = rowToLabResult(row)
    assert.equal(back.status, "amended")
  })
})
