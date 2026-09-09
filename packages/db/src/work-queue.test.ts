import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { WorkQueue } from "./work-queue.ts"

describe("WorkQueue operational spine", () => {
  it("creates one task for repeated idempotency keys", () => {
    const queue = new WorkQueue()
    const input = {
      tenantId: "tenant-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "opd",
      ownerRole: "nurse",
      taskType: "triage" as const,
      title: "Triage patient",
      idempotencyKey: "encounter-1:triage",
    }
    const first = queue.create(input)
    const retry = queue.create(input)
    assert.equal(first.ok, true)
    assert.equal(retry.ok, true)
    if (first.ok && retry.ok) assert.equal(retry.task.id, first.task.id)
    assert.equal(queue.list({ tenantId: "tenant-1" }).length, 1)
  })

  it("advances a handoff through accept, start, and completion", () => {
    const queue = new WorkQueue()
    const created = queue.create({
      tenantId: "tenant-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      ownerDepartment: "laboratory",
      taskType: "lab_collection",
      title: "Collect specimen",
      idempotencyKey: "order-1:collection",
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(queue.accept(created.task.id, "staff-1").ok, true)
    assert.equal(queue.start(created.task.id, "staff-1").ok, true)
    const completed = queue.complete(created.task.id, "Specimen collected", "staff-1")
    assert.equal(completed.ok, true)
    if (completed.ok) assert.equal(completed.task.status, "COMPLETED")
  })

})