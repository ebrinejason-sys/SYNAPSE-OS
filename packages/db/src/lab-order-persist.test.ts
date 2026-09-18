import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { InvalidIdentifierError } from "./identifiers.ts"
import { labOrderToRow, persistLabOrderBestEffort } from "./lab-order-persist.ts"
import type { LabOrder } from "./lab-workflow.ts"

function order(patch: Partial<LabOrder> = {}): LabOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    patientId: "33333333-3333-4333-8333-333333333333",
    personId: null,
    encounterId: "44444444-4444-4444-8444-444444444444",
    carePlanId: null,
    loincCode: "58413-6",
    testName: "Malaria Pf antigen",
    urgency: "URGENT",
    status: "ORDERED",
    orderedBy: "55555555-5555-4555-8555-555555555555",
    orderedAt: "2026-09-18T00:00:00.000Z",
    isSynthetic: true,
    simulationRunId: null,
    correlationId: "44444444-4444-4444-8444-444444444444",
    replacesLabOrderId: null,
    ...patch,
  }
}

describe("lab-order-persist", () => {
  it("maps synthetic orders to the canonical classification and legacy ordered status", () => {
    const row = labOrderToRow(order())
    assert.equal(row.status, "ordered")
    assert.equal(row.workflow_status, "ORDERED")
    assert.equal(row.data_classification, "synthetic")
    assert.equal(row.person_id, null)
    assert.equal(row.replaces_lab_order_id, null)
  })

  it("maps live clinical orders to clinical, never the invalid production class", () => {
    const row = labOrderToRow(order({ isSynthetic: false }))
    assert.equal(row.data_classification, "clinical")
  })

  it("rejects the string undefined on tenant_id before touching the database", async () => {
    let called = false
    const db = {
      from() {
        called = true
        return { upsert: async () => ({ error: null }) }
      },
    }
    const result = await persistLabOrderBestEffort(db, order({ tenantId: "undefined" }))
    assert.equal(called, false)
    assert.equal(result.ok, false)
    if (result.ok) throw new Error("expected persist failure")
    assert.equal(result.error, "INVALID_IDENTIFIER:tenant_id")
  })

  it("rejects malformed person_id instead of sending it as a UUID", () => {
    assert.throws(() => labOrderToRow(order({ personId: "undefined" })), InvalidIdentifierError)
  })
})
