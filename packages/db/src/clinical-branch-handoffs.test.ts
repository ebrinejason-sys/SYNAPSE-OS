import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { WorkQueue } from "./work-queue.ts"

describe("clinical branch handoffs", () => {
  it("creates pharmacy work without creating Lab work", () => {
    const queue = new WorkQueue()
    const task = queue.create({
      tenantId: "tenant-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "pharmacy",
      ownerRole: "pharmacist",
      taskType: "prescription",
      title: "Rx: amoxicillin",
      sourceResource: "clinical_prescriptions",
      sourceId: "rx-1",
      idempotencyKey: "clinical_prescriptions:rx-1:prescription",
    })
    assert.equal(task.ok, true)
    assert.equal(queue.list({ tenantId: "tenant-1", ownerDepartment: "laboratory" }).length, 0)
    assert.equal(queue.list({ tenantId: "tenant-1", ownerDepartment: "pharmacy" }).length, 1)
  })

  it("creates one billing task for an unpaid invoice", () => {
    const queue = new WorkQueue()
    const first = queue.create({
      tenantId: "tenant-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "billing",
      ownerRole: "cashier",
      taskType: "billing",
      title: "Payment required",
      sourceResource: "billing_invoices",
      sourceId: "invoice-1",
      idempotencyKey: "billing_invoices:invoice-1:payment",
    })
    const retry = queue.create({
      tenantId: "tenant-1",
      ownerDepartment: "billing",
      taskType: "billing",
      title: "Payment required",
      sourceResource: "billing_invoices",
      sourceId: "invoice-1",
      idempotencyKey: "billing_invoices:invoice-1:payment",
    })
    assert.equal(first.ok, true)
    assert.equal(retry.ok, true)
    if (first.ok && retry.ok) assert.equal(first.task.id, retry.task.id)
    assert.equal(queue.list({ tenantId: "tenant-1", ownerDepartment: "billing" }).length, 1)
  })
})