import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { recordEncounterOpened } from "./clinical-journey.ts"

describe("clinical-journey", () => {
  it("records EncounterCreated and triage task with shared correlation id", () => {
    const encounterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const result = recordEncounterOpened({
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      hospitalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      patientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      encounterId,
      requesterId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      chiefComplaint: "fever and chills",
    })

    assert.equal(result.correlationId, encounterId)
    assert.equal(result.triageTask.taskType, "triage")
    assert.equal(result.triageTask.ownerDepartment, "opd")
    assert.equal(result.triageTask.isSynthetic, false)

    const events = result.queue.outbox.list({ correlationId: encounterId })
    assert.ok(events.some((event) => event.event_type === "EncounterCreated"))
    assert.ok(events.every((event) => event.correlation_id === encounterId))
  })

  it("is idempotent for triage task creation", () => {
    const queueInput = {
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      hospitalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      patientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      encounterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requesterId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      chiefComplaint: "fever",
    }
    const first = recordEncounterOpened(queueInput)
    const second = recordEncounterOpened({ ...queueInput, queue: first.queue })
    assert.equal(first.triageTask.id, second.triageTask.id)
  })
})
