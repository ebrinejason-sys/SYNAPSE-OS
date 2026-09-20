import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { toCanonicalTimelineEventType, toCanonicalTimelineSeverity, toTimelineInsert } from "./timeline.ts"
import { paymentRecordedTimelineEvent } from "./clinical-timeline.ts"

const tenantId = "0edb651a-232a-4289-9b3d-ae5bb1bac2cb"
const patientId = "19bc626f-f51a-4bd5-aefd-7a4534babfeb"
const encounterId = "72603ece-b91a-45ad-a6bc-c59bff1162db"

describe("canonical timeline persist mapping", () => {
  it("maps domain clinical types onto the schema CHECK list", () => {
    assert.equal(toCanonicalTimelineEventType("consultation"), "encounter")
    assert.equal(toCanonicalTimelineEventType("laboratory"), "lab_result")
    assert.equal(toCanonicalTimelineEventType("prescription"), "medication")
    assert.equal(toCanonicalTimelineEventType("billing"), "note")
    assert.equal(toCanonicalTimelineEventType("document"), "note")
    assert.equal(toCanonicalTimelineEventType("lab_result"), "lab_result")
  })

  it("maps abnormal severity to warning and drops unknown severities", () => {
    assert.equal(toCanonicalTimelineSeverity("abnormal"), "warning")
    assert.equal(toCanonicalTimelineSeverity("critical"), "critical")
    assert.equal(toCanonicalTimelineSeverity("purple"), null)
  })

  it("does not write a non-uuid source_id such as a receipt number", () => {
    const row = toTimelineInsert({
      tenantId,
      patientId,
      eventType: "billing",
      title: "Payment recorded",
      sourceTable: "billing_payments",
      sourceId: "RCP-20260920-1234",
      payload: { encounterId },
    })
    assert.equal(row.event_type, "note")
    assert.equal(row.source_id, null)
    assert.equal(row.tenant_id, tenantId)
    assert.equal(row.patient_id, patientId)
  })

  it("keeps a payment UUID as source_id", () => {
    const paymentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const event = paymentRecordedTimelineEvent({
      tenantId,
      hospitalId: "97d61d46-32c5-4d34-b3d3-61330ae8e62c",
      patientId,
      encounterId,
      paymentId,
      amount: 34800,
      receiptNumber: "RCP-20260920-1234",
      paymentMethod: "cash",
    })
    const row = toTimelineInsert(event)
    assert.equal(row.source_id, paymentId)
    assert.equal((row.payload as { encounterId: string }).encounterId, encounterId)
    assert.equal(row.event_type, "note")
  })
})
