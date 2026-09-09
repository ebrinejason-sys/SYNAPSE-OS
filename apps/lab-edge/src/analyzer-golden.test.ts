import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import * as FhirModule from "../../../packages/interop/src/fhir/r4.ts"
import * as LabWorkflowModule from "../../../packages/db/src/lab-workflow.ts"
import {
  buildAstmCbcSimulatorMessage,
  EdgeDurableQueue,
  parseAstmResults,
} from "./index.ts"

const TENANT_ID = "00000000-0000-4000-8000-000000000001"
const PATIENT_ID = "patient-golden-1"
const ORDER_ID = "order-golden-1"
const ACCESSION = "LAB-20260908-00001"
const DEVICE_ID = "analyzer-golden-1"

type GoldenOrder = {
  id: string
  tenantId: string
  patientId: string
  encounterId: string
  loincCode: string
  testName: string
  urgency: "STAT" | "URGENT" | "ROUTINE"
  status: "ORDERED"
  orderedBy: string
  orderedAt: string
  accessionNumber: string
  barcode: string
  specimenId: string
  isSynthetic: boolean
  correlationId: string
}

const LabWorkflow = ((LabWorkflowModule as { default?: typeof LabWorkflowModule }).default ?? LabWorkflowModule).LabWorkflow
const Fhir = ((FhirModule as { default?: typeof FhirModule }).default ?? FhirModule)

describe("ANALYZER_GOLDEN", () => {
  it("runs CBC from durable raw message through human release and Exchange/FHIR output", () => {
    const directory = mkdtempSync(join(tmpdir(), "synapse-analyzer-golden-"))
    const queue = new EdgeDurableQueue(join(directory, "edge.sqlite"))
    const rawPayload = buildAstmCbcSimulatorMessage(ACCESSION)
    const queued = queue.enqueue(rawPayload, "ASTM")
    const rawAfterRestart = (() => {
      queue.close()
      const restarted = new EdgeDurableQueue(join(directory, "edge.sqlite"))
      const item = restarted.get(queued.id)!
      return { item, restarted }
    })()

    const parsed = parseAstmResults(rawAfterRestart.item.rawPayload, rawAfterRestart.item.id)
    assert.equal(rawAfterRestart.item.state, "QUEUED")
    assert.equal(parsed.length, 2)
    assert.ok(parsed.every((result) => result.accessionNumber === ACCESSION))

    const mappings = new Map([
      ["WBC", { loincCode: "6690-2", testName: "White blood cells" }],
      ["HGB", { loincCode: "718-7", testName: "Hemoglobin" }],
    ])
    const staged = parsed.map((result) => ({
      ...result,
      status: mappings.has(result.analyzerCode) ? "READY_FOR_REVIEW" : "MAPPING_REQUIRED",
      mapping: mappings.get(result.analyzerCode) ?? null,
    }))
    assert.ok(staged.every((result) => result.status === "READY_FOR_REVIEW"))

    const order: GoldenOrder = {
      id: ORDER_ID,
      tenantId: TENANT_ID,
      patientId: PATIENT_ID,
      encounterId: "encounter-golden-1",
      loincCode: "58450-8",
      testName: "Complete blood count",
      urgency: "ROUTINE",
      status: "ORDERED",
      orderedBy: "clinician-golden-1",
      orderedAt: "2026-09-08T08:00:00.000Z",
      accessionNumber: ACCESSION,
      barcode: "LAB2026090800001",
      specimenId: "specimen-golden-1",
      isSynthetic: true,
      correlationId: "correlation-golden-1",
    }
    const workflow = new LabWorkflow([order])
    workflow.collect(ORDER_ID, ACCESSION, order.barcode, order.specimenId)
    workflow.receive(ORDER_ID)
    const entered = workflow.enterResult({
      resultId: "result-golden-1",
      orderId: ORDER_ID,
      value: staged[0]!.value,
      analyzer: DEVICE_ID,
    })
    assert.equal(entered.order.status, "VERIFICATION_PENDING")
    assert.equal(entered.result.provenance, "SYSTEM_GENERATED")
    assert.equal(entered.result.releasedAt, undefined)

    const verified = workflow.verify(ORDER_ID, "lab-scientist-golden-1")
    const released = workflow.release(ORDER_ID)
    assert.equal(verified.verifiedBy, "lab-scientist-golden-1")
    assert.equal(released.releasedAt != null, true)
    assert.equal(workflow.getOrder(ORDER_ID).status, "RELEASED")

    const observation = Fhir.toFhirObservation({
      resourceType: "Observation",
      id: released.id,
      code: released.loincCode,
      display: released.testName,
      value: released.resultValue,
      personId: PATIENT_ID,
      specimenId: order.specimenId,
      interpretation: released.flag,
      referenceRange: released.referenceRange,
    }, TENANT_ID)
    const report = Fhir.toFhirDiagnosticReport({
      id: "report-golden-1",
      patientId: PATIENT_ID,
      observationIds: [String(observation.id)],
      code: order.loincCode,
      display: order.testName,
      tenantId: TENANT_ID,
    })
    const event = {
      event_type: "LabResultReleased",
      tenant_id: TENANT_ID,
      patient_id: PATIENT_ID,
      correlation_id: order.correlationId,
      payload: { accession: ACCESSION, observation, report, pdf: "report-golden-1.pdf" },
      status: "pending",
    }
    assert.equal(observation.resourceType, "Observation")
    assert.equal(report.resourceType, "DiagnosticReport")
    assert.equal(event.event_type, "LabResultReleased")
    assert.equal(event.status, "pending")

    rawAfterRestart.restarted.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it("keeps unsafe analyzer messages out of clinical workflow", () => {
    const parsed = parseAstmResults(buildAstmCbcSimulatorMessage("UNKNOWN-ACCESSION"), "raw-unsafe")
    assert.ok(parsed.every((result) => result.accessionNumber === "UNKNOWN-ACCESSION"))
    const knownAccessions = new Set([ACCESSION])
    const accessionStatus = knownAccessions.has(parsed[0]!.accessionNumber ?? "") ? "MATCHED" : "UNMATCHED"
    assert.equal(accessionStatus, "UNMATCHED")

    const mapping = new Map<string, string>()
    const status = mapping.has(parsed[0]!.analyzerCode) ? "READY_FOR_REVIEW" : "MAPPING_REQUIRED"
    assert.equal(status, "MAPPING_REQUIRED")
    assert.equal(parsed.some((result) => result.rawMessageRef === "raw-unsafe"), true)
    assert.equal("releasedAt" in parsed[0]!, false)
  })
})