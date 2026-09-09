import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLabReportArtifact } from "./lab-report.ts"

describe("Lab report artifacts", () => {
  it("renders escaped structured results with a reproducible content hash", () => {
    const input = {
      id: "report-1",
      tenantId: "tenant-1",
      patientId: "patient-1",
      orderId: "order-1",
      clinicalResultId: "result-1",
      accession: "LAB-20260908-000001",
      testName: "CBC <panel>",
      loincCode: "58450-8",
      specimenType: "EDTA blood",
      reportedAt: "2026-09-08T12:00:00.000Z",
      resultValue: "6.8",
      unit: "10*9/L",
      referenceRange: "4.0-11.0 10*9/L",
      abnormalFlag: "N",
      verifiedBy: "scientist-1",
    }
    const first = buildLabReportArtifact(input)
    const second = buildLabReportArtifact(input)
    assert.equal(first.contentHash, second.contentHash)
    assert.equal(first.htmlSnapshot.includes("CBC &lt;panel&gt;"), true)
    assert.equal(first.htmlSnapshot.includes("LAB-20260908-000001"), true)
    assert.equal(first.templateVersion, "lab-report.v1")
    assert.equal(first.status, "FINAL")
  })
})