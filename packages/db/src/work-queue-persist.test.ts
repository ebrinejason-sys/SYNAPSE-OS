import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { departmentTaskToRow, rowToDepartmentTask } from "./work-queue-persist.ts"
import type { DepartmentTask } from "./work-queue.ts"

const sampleTask: DepartmentTask = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  facilityId: null,
  hospitalId: "33333333-3333-4333-8333-333333333333",
  patientId: "44444444-4444-4444-8444-444444444444",
  personId: null,
  encounterId: "55555555-5555-4555-8555-555555555555",
  requesterId: "66666666-6666-4666-8666-666666666666",
  ownerDepartment: "opd",
  ownerRole: "nurse",
  taskType: "triage",
  priority: "ROUTINE",
  status: "REQUESTED",
  title: "Triage: fever",
  description: null,
  sourceResource: "encounters",
  sourceId: "55555555-5555-4555-8555-555555555555",
  correlationId: "55555555-5555-4555-8555-555555555555",
  causationId: null,
  idempotencyKey: "encounters:55555555-5555-4555-8555-555555555555:triage",
  dueAt: null,
  acceptedAt: null,
  completedAt: null,
  cancelledAt: null,
  assignedTo: null,
  resultSummary: null,
  metadata: { hop: "triage" },
  isSynthetic: false,
  simulationRunId: null,
  createdAt: "2026-08-30T07:00:00.000Z",
  updatedAt: "2026-08-30T07:00:00.000Z",
}

describe("work-queue-persist", () => {
  it("round-trips department task rows", () => {
    const row = departmentTaskToRow(sampleTask)
    const restored = rowToDepartmentTask(row)
    assert.equal(restored.id, sampleTask.id)
    assert.equal(restored.taskType, "triage")
    assert.equal(restored.correlationId, sampleTask.encounterId)
    assert.deepEqual(restored.metadata, { hop: "triage" })
  })
})
