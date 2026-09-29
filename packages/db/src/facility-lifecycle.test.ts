import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { assertPurgeConfirmation, isMissingRelationError, nextFacilityLifecycleState, previewFacilityLifecycle } from "./facility-lifecycle.ts"
import { previewIdentityLifecycle } from "./identity-lifecycle.ts"

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

  it("blocks purge when audit history exists even for a synthetic facility", () => {
    const preview = previewFacilityLifecycle({
      tenantId: "synthetic",
      currentState: "DELETION_PENDING",
      action: "purge",
      isSynthetic: true,
      allowHardPurge: true,
      counts: { auditEvents: 3 },
    })
    assert.equal(preview.allowed, false)
    assert.equal(preview.retainAuditHistory, true)
  })

  it("treats a missing column as incomplete analysis, not an empty facility", () => {
    assert.equal(isMissingRelationError("42P01", "relation does not exist"), true)
    assert.equal(isMissingRelationError("PGRST205", "Could not find the table 'public.mortuary_records' in the schema cache"), true)
    assert.equal(isMissingRelationError("42703", "column clinical_documents.tenant_id does not exist"), false)
  })

  it("requires typed facility name or id and acknowledgement", () => {
    assert.equal(
      assertPurgeConfirmation({
        facilityName: "Synthetic Lab",
        facilityId: "fac-1",
        typedConfirmation: "wrong",
        acknowledged: true,
      }).ok,
      false,
    )
    assert.equal(
      assertPurgeConfirmation({
        facilityName: "Synthetic Lab",
        facilityId: "fac-1",
        typedConfirmation: "fac-1",
        acknowledged: false,
      }).ok,
      false,
    )
    assert.equal(
      assertPurgeConfirmation({
        facilityName: "Synthetic Lab",
        facilityId: "fac-1",
        typedConfirmation: "Synthetic Lab",
        acknowledged: true,
      }).ok,
      true,
    )
  })
})

describe("identity lifecycle", () => {
  it("blocks self-archive even when another platform admin exists (2026-09-26 acceptance incident)", () => {
    const preview = previewIdentityLifecycle({
      userId: "admin-a",
      actorId: "admin-a",
      action: "archive",
      role: "platform_admin",
      activePlatformAdminCount: 2,
    })
    assert.equal(preview.allowed, false)
    assert.match(preview.blockers.join(" "), /your own account/)
  })

  for (const action of ["deactivate", "suspend", "archive", "purge", "remove_membership"] as const) {
    it(`blocks self-${action} for any role`, () => {
      const preview = previewIdentityLifecycle({
        userId: "u1",
        actorId: "u1",
        action,
        role: "hospital_admin",
        activePlatformAdminCount: 5,
        email: "u1@example.com",
        typedConfirmation: "u1@example.com",
      })
      assert.equal(preview.allowed, false)
      assert.match(preview.blockers.join(" "), /your own account/)
    })
  }

  it("still allows archiving another platform admin when more than one exists", () => {
    const preview = previewIdentityLifecycle({
      userId: "admin-b",
      actorId: "admin-a",
      action: "archive",
      role: "platform_admin",
      activePlatformAdminCount: 2,
    })
    assert.equal(preview.allowed, true)
  })

  it("does not treat non-destructive self actions (restore, revoke_sessions) as self-destructive", () => {
    for (const action of ["revoke_sessions", "activate"] as const) {
      const preview = previewIdentityLifecycle({ userId: "u1", actorId: "u1", action, role: "doctor" })
      assert.equal(preview.allowed, true, action)
    }
  })

  it("keeps identity when a facility membership is removed", () => {
    const preview = previewIdentityLifecycle({
      userId: "u1",
      action: "remove_membership",
      role: "doctor",
    })
    assert.equal(preview.allowed, true)
    assert.equal(preview.identityPreserved, true)
  })

  it("blocks deletion of the last platform admin", () => {
    const preview = previewIdentityLifecycle({
      userId: "admin",
      action: "purge",
      role: "platform_admin",
      activePlatformAdminCount: 1,
      email: "admin@example.com",
      typedConfirmation: "admin@example.com",
    })
    assert.equal(preview.allowed, false)
    assert.match(preview.blockers.join(" "), /last Platform Admin/)
  })

  it("blocks permanent deletion when historical authorship exists", () => {
    const preview = previewIdentityLifecycle({
      userId: "doc",
      action: "purge",
      role: "doctor",
      authoredRecords: 2,
      email: "doc@example.com",
      typedConfirmation: "doc@example.com",
    })
    assert.equal(preview.allowed, false)
    assert.match(preview.blockers.join(" "), /authorship/)
  })

  it("allows suspend and distinguishes it from archive", () => {
    const suspended = previewIdentityLifecycle({
      userId: "u",
      action: "suspend",
      role: "nurse",
      activePlatformAdminCount: 2,
    })
    const archived = previewIdentityLifecycle({
      userId: "u",
      action: "archive",
      role: "nurse",
    })
    assert.equal(suspended.allowed, true)
    assert.equal(archived.allowed, true)
    assert.equal(suspended.identityPreserved, true)
    assert.equal(archived.identityPreserved, true)
  })
})
