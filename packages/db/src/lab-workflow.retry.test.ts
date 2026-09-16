import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LabWorkflow,
  barcodeFromAccession,
  formatAccession,
  type LabOrder,
} from "./lab-workflow.ts"

function seedEntered(lab: LabWorkflow): { orderId: string; specimenId: string } {
  const orderId = crypto.randomUUID()
  const specimenId = crypto.randomUUID()
  const order: LabOrder = {
    id: orderId,
    tenantId: crypto.randomUUID(),
    patientId: crypto.randomUUID(),
    encounterId: crypto.randomUUID(),
    loincCode: "58413-6",
    testName: "Malaria Pf antigen",
    urgency: "ROUTINE",
    status: "ORDERED",
    orderedBy: crypto.randomUUID(),
    orderedAt: new Date().toISOString(),
    isSynthetic: true,
    correlationId: orderId,
  }
  lab.createOrder(order)
  const accession = formatAccession("LAB", 1)
  lab.collect(orderId, accession, barcodeFromAccession(accession), specimenId)
  lab.receive(orderId)
  lab.enterResult({ resultId: crypto.randomUUID(), orderId, value: "Negative" })
  return { orderId, specimenId }
}

describe("lab-workflow audit-fail retries", () => {
  it("collect retry does not replace a committed specimen", () => {
    const lab = new LabWorkflow()
    const { orderId, specimenId } = seedEntered(lab)
    const again = lab.collect(orderId, "SHOULD-NOT-APPLY", "NOPE", crypto.randomUUID())
    assert.equal(again.specimenId, specimenId)
    assert.notEqual(again.accessionNumber, "SHOULD-NOT-APPLY")
  })

  it("verify/release retry after committed domain write does not throw or mutate", () => {
    const lab = new LabWorkflow()
    const { orderId } = seedEntered(lab)
    const first = lab.verify(orderId, "scientist-1")
    const verifyRetry = lab.verify(orderId, "scientist-1")
    assert.equal(verifyRetry.id, first.id)
    assert.equal(verifyRetry.status, "final")
    assert.equal(lab.getOrder(orderId).status, "VERIFIED")

    const released = lab.release(orderId)
    const releaseRetry = lab.release(orderId)
    assert.equal(releaseRetry.id, released.id)
    assert.equal(lab.getOrder(orderId).status, "RELEASED")
    assert.equal(releaseRetry.releasedAt, released.releasedAt)
  })

  it("amend retry with the same amendment id and content does not bump version", () => {
    const lab = new LabWorkflow()
    const { orderId } = seedEntered(lab)
    lab.verify(orderId, "scientist-1")
    const amendmentId = crypto.randomUUID()
    const first = lab.amend({
      amendmentId,
      orderId,
      newValue: "Positive",
      reason: "repeat smear",
      amendedBy: "scientist-1",
    })
    assert.equal(first.result.version, 2)
    const retry = lab.amend({
      amendmentId,
      orderId,
      newValue: "Positive",
      reason: "repeat smear",
      amendedBy: "scientist-1",
    })
    assert.equal(retry.result.version, 2)
    assert.equal(retry.result.resultValue, "Positive")
    assert.equal(retry.amendment.id, first.amendment.id)
    assert.equal(lab.snapshot().amendments.length, 1)
  })

  it("rejects amendment id reuse for another result or changed content", () => {
    const lab = new LabWorkflow()
    const { orderId } = seedEntered(lab)
    lab.verify(orderId, "scientist-1")
    const input = { amendmentId: crypto.randomUUID(), orderId, newValue: "Positive", reason: "repeat smear", amendedBy: "scientist-1" }
    lab.amend(input)
    for (const change of [{ newValue: "Negative" }, { reason: "different reason" }, { amendedBy: "scientist-2" }]) {
      assert.throws(() => lab.amend({ ...input, ...change }), /LAB_AMEND_IDEMPOTENCY_CONFLICT/)
    }
    const other = seedEntered(lab)
    lab.verify(other.orderId, "scientist-1")
    assert.throws(() => lab.amend({ ...input, orderId: other.orderId }), /LAB_AMEND_IDEMPOTENCY_CONFLICT/)
    assert.equal(lab.snapshot().amendments.length, 1)
  })

  it("does not mistake equal values on different results for the same amendment", () => {
    const lab = new LabWorkflow()
    const first = seedEntered(lab)
    const second = seedEntered(lab)
    for (const { orderId } of [first, second]) {
      lab.verify(orderId, "scientist-1")
      lab.amend({ amendmentId: crypto.randomUUID(), orderId, newValue: "Positive", reason: "repeat", amendedBy: "scientist-1" })
    }
    const amendments = lab.snapshot().amendments
    assert.equal(amendments.length, 2)
    assert.notEqual(amendments[0].resultId, amendments[1].resultId)
  })
})
