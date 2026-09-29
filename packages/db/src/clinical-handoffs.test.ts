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

  it("hands off a triage task that a nurse already started", () => {
    const opened = recordEncounterOpened({
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-2",
      encounterId: "encounter-2",
      requesterId: "nurse-1",
      chiefComplaint: "cough",
    })
    assert.ok(opened.queue.start(opened.triageTask.id, "nurse-1").ok)
    const handoff = recordTriageCompleted({
      queue: opened.queue,
      triageTaskId: opened.triageTask.id,
      tenantId: "tenant-1",
      hospitalId: "hospital-1",
      patientId: "patient-2",
      encounterId: "encounter-2",
      requesterId: "nurse-1",
    })
    assert.equal(opened.queue.get(opened.triageTask.id)?.status, "COMPLETED")
    assert.equal(handoff.doctorTask.ownerRole, "doctor")
  })
})