import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { recordEncounterOpened, recordTriageCompleted } from "./clinical-journey.ts"

describe("clinical handoffs", () => {
  it("hands a completed triage encounter to one Doctor task", () => {
    const opened = recordEncounterOpened({
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      requesterId: "nurse-1",
      chiefComplaint: "fever",
    })
    const first = recordTriageCompleted({
      queue: opened.queue,
      triageTaskId: opened.triageTask.id,
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      requesterId: "nurse-1",
    })
    assert.equal(first.doctorTask.taskType, "consultation")
    assert.equal(first.doctorTask.ownerRole, "doctor")
    assert.equal(first.doctorTask.patientId, "patient-1")
    assert.equal(first.doctorTask.encounterId, "encounter-1")
    assert.equal(opened.triageTask.status, "COMPLETED")

    const retryQueue = first.queue
    assert.throws(() => recordTriageCompleted({
      queue: retryQueue,
      triageTaskId: opened.triageTask.id,
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-1",
      encounterId: "encounter-1",
      requesterId: "nurse-1",
    }), /INVALID_TRANSITION/)
    assert.equal(retryQueue.list({ tenantId: "tenant-1" }).filter((task) => task.ownerRole === "doctor").length, 1)
  })
})