import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { WorkQueue } from "./work-queue.ts"

describe("WorkQueue handoffs", () => {
  it("completes a Lab task and creates one Doctor result-review task", () => {
    const queue = new WorkQueue()
    const lab = queue.create({
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "laboratory",
      taskType: "lab_order",
      title: "Lab: CBC",
      sourceResource: "lab_orders",
      sourceId: "order-1",
      idempotencyKey: "lab_orders:order-1:lab_order",
    })
    assert.equal(lab.ok, true)
    if (!lab.ok) return

    assert.equal(queue.start(lab.task.id, "scientist-1").ok, true)
    assert.equal(queue.complete(lab.task.id, "Laboratory result released", "scientist-1").ok, true)

    const first = queue.create({
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "opd",
      ownerRole: "doctor",
      taskType: "doctor_result_review",
      title: "Doctor review: released result",
      sourceResource: "lab_results",
      sourceId: "result-1",
      idempotencyKey: "lab_results:result-1:doctor-result-review",
    })
    const retry = queue.create({
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      ownerDepartment: "opd",
      taskType: "doctor_result_review",
      title: "Doctor review: released result",
      sourceResource: "lab_results",
      sourceId: "result-1",
      idempotencyKey: "lab_results:result-1:doctor-result-review",
    })
    assert.equal(first.ok, true)
    assert.equal(retry.ok, true)
    if (first.ok && retry.ok) assert.equal(first.task.id, retry.task.id)
    assert.equal(queue.list({ tenantId: "tenant-1" }).length, 2)
  })
})