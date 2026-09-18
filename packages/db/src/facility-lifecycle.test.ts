import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { nextFacilityLifecycleState, previewFacilityLifecycle } from "./facility-lifecycle.ts"

describe("facility lifecycle", () => {
  it("supports suspend, resume, archive, restore, delete request and cancel", () => {
    assert.equal(nextFacilityLifecycleState("ACTIVE", "suspend"), "SUSPENDED")
    assert.equal(nextFacilityLifecycleState("SUSPENDED", "resume"), "ACTIVE")
    assert.equal(nextFacilityLifecycleState("ACTIVE", "archive"), "ARCHIVED")
    assert.equal(nextFacilityLifecycleState("ARCHIVED", "restore"), "ACTIVE")
    assert.equal(nextFacilityLifecycleState("ACTIVE", "request_delete"), "DELETION_PENDING")
    assert.equal(nextFacilityLifecycleState("DELETION_PENDING", "cancel_delete"), "ARCHIVED")
  })

  it("blocks hard purge of production clinical/financial history", () => {
    const preview = previewFacilityLifecycle({
      tenantId: "t1",
      currentState: "DELETION_PENDING",
      action: "purge",
      isSynthetic: false,
      allowHardPurge: true,
      counts: { patients: 12, encounters: 4, invoices: 2 },
    })
    assert.equal(preview.allowed, false)
    assert.equal(preview.retainClinicalHistory, true)
    assert.equal(preview.retainFinancialHistory, true)
  })

  it("allows synthetic purge only with no retained history", () => {
    const preview = previewFacilityLifecycle({
      tenantId: "synthetic",
      currentState: "DELETION_PENDING",
      action: "purge",
      isSynthetic: true,
      allowHardPurge: true,
    })
    assert.equal(preview.allowed, true)
    assert.equal(preview.nextState, "DELETED")
  })
})
