import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { reconcileEncounterTasks } from "./clinical-journey.ts"
import { WorkQueue } from "./work-queue.ts"

function createTask(queue: WorkQueue, taskType: "triage" | "lab_order" | "prescription" | "billing", sourceId: string) {
  const result = queue.create({
    tenantId: "tenant-1",
    hospitalId: "hospital-1",
    patientId: "patient-1",
    encounterId: "encounter-1",
    ownerDepartment: taskType === "billing" ? "billing" : taskType === "prescription" ? "pharmacy" : taskType === "lab_order" ? "laboratory" : "opd",
    taskType,
    title: taskType,
    sourceResource: taskType === "billing" ? "billing_invoices" : taskType === "lab_order" ? "lab_orders" : taskType === "prescription" ? "clinical_prescriptions" : "encounters",
    sourceId,
    idempotencyKey: `${taskType}:${sourceId}`,
  })
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  return result.task
}

describe("encounter task reconciliation", () => {
  it("completes stale tasks only from authoritative completed state", () => {
    const queue = new WorkQueue()
    const triage = createTask(queue, "triage", "encounter-1")
    const lab = createTask(queue, "lab_order", "order-1")
    const rx = createTask(queue, "prescription", "rx-1")
    const billing = createTask(queue, "billing", "invoice-1")
    const result = reconcileEncounterTasks(queue, "tenant-1", "encounter-1", "admin-1", {
      triageCompleted: true,
      releasedLabOrderIds: ["order-1"],
      dispensedPrescriptionIds: ["rx-1"],
      invoice: { status: "paid", totalAmount: 100, paidAmount: 100 },
    })
    assert.deepEqual(result.reconciled.map((task) => task.id).sort(), [triage.id, lab.id, rx.id, billing.id].sort())
    assert.ok(result.reconciled.every((task) => task.status === "COMPLETED"))
  })

  it("cancels stale Lab and Pharmacy tasks without deleting history", () => {
    const queue = new WorkQueue()
    const lab = createTask(queue, "lab_order", "order-2")
    const rx = createTask(queue, "prescription", "rx-2")
    const result = reconcileEncounterTasks(queue, "tenant-1", "encounter-1", "admin-1", {
      cancelledLabOrderIds: ["order-2"],
      cancelledPrescriptionIds: ["rx-2"],
    })
    assert.deepEqual(result.reconciled.map((task) => task.id).sort(), [lab.id, rx.id].sort())
    assert.ok(result.reconciled.every((task) => task.status === "CANCELLED"))
    assert.equal(queue.list({ tenantId: "tenant-1", encounterId: "encounter-1" }).length, 2)
  })

  it("does not reconcile another tenant's task with the same encounter id", () => {
    const queue = new WorkQueue()
    const foreign = queue.create({
      tenantId: "tenant-2",
      patientId: "patient-2",
      encounterId: "encounter-1",
      ownerDepartment: "laboratory",
      taskType: "lab_order",
      title: "Foreign Lab",
      sourceId: "order-foreign",
      idempotencyKey: "tenant-2:order-foreign",
    })
    assert.equal(foreign.ok, true)
    reconcileEncounterTasks(queue, "tenant-1", "encounter-1", "admin-1", {
      releasedLabOrderIds: ["order-foreign"],
    })
    if (foreign.ok) assert.equal(foreign.task.status, "REQUESTED")
  })
})