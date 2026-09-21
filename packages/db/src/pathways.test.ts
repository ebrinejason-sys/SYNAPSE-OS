import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PathwayRuntime,
  assertClinicianActivatesPathway,
  assertClinicianPlacesOrder,
  getPathway,
  instantiateCarePlan,
  listPathways,
  retirePathway,
  suggestPathwaysFromContext,
} from "./pathways.ts"

const ids = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  patientId: "33333333-3333-4333-8333-333333333333",
  encounterId: "44444444-4444-4444-8444-444444444444",
}

describe("clinical pathways", () => {
  it("keeps existing pathways and adds the first expansion set with provenance", () => {
    const catalog = listPathways({ countryPack: "UG", status: "active" })
    for (const id of ["pathway.adult-sepsis", "pathway.malaria", "pathway.dka", "pathway.pneumonia", "pathway.hypertensive-emergency", "pathway.acs", "pathway.stroke", "pathway.severe-malaria", "pathway.postpartum-hemorrhage"]) {
      assert.ok(catalog.some((item) => item.id === id), id)
    }
    assert.ok(catalog.every((item) => item.steps.length >= 4))
    assert.ok(catalog.every((item) => item.source.organization.length > 0))
    assert.ok(catalog.every((item) => item.countryPack === "UG"))
  })

  it("suggests, activates, completes, overrides, completes, and abandons while freezing version", () => {
    const suggestions = suggestPathwaysFromContext({
      presentingComplaint: "fever hypotension tachycardia",
      vitals: { sbp: 88 },
      laboratory: [{ test: "malaria pf", value: "positive" }],
      countryPack: "UG",
    })
    assert.ok(suggestions.some((row) => row.pathwayId === "pathway.adult-sepsis"))
    assert.ok(suggestions.some((row) => row.pathwayId === "pathway.malaria" || row.pathwayId === "pathway.severe-malaria"))

    const pathway = getPathway("pathway.adult-sepsis")
    const plan = instantiateCarePlan({
      id: "plan-1",
      ...ids,
      pathway,
      correlationId: "corr-1",
    })
    const runtime = new PathwayRuntime()
    runtime.start(plan)
    runtime.completeStep({ carePlanId: plan.id, stepId: "assess" })
    runtime.overrideStep({
      overrideId: "ovr-1",
      carePlanId: plan.id,
      stepId: "investigate",
      actualAction: "Deferred lactate pending access",
      reason: "No lactate assay available",
      clinicianId: "doctor-1",
      patientContextReference: ids.encounterId,
    })
    const frozen = runtime.get(plan.id)
    assert.equal(frozen.pathwayVersion, pathway.version)
    runtime.recordOutcome(plan.id, "improving")
    const abandoned = instantiateCarePlan({
      id: "plan-2",
      ...ids,
      pathway,
      correlationId: "corr-2",
    })
    runtime.start(abandoned)
    runtime.abandon(abandoned.id, "Transferred before completion")
    assert.equal(runtime.get(abandoned.id).status, "abandoned")
  })

  it("forbids AI auto-start and AI auto-order, and keeps retired versions from new starts", () => {
    assert.throws(() => assertClinicianActivatesPathway({ kind: "ai" }), /PATHWAY_AI_CANNOT_ACTIVATE/)
    assert.throws(() => assertClinicianPlacesOrder({ kind: "ai" }), /PATHWAY_AI_CANNOT_ORDER/)
    const retired = retirePathway(getPathway("pathway.dka"))
    assert.equal(retired.status, "retired")
    assert.throws(() => instantiateCarePlan({
      id: "plan-retired",
      ...ids,
      pathway: retired,
      correlationId: "corr-3",
    }), /PATHWAY_NOT_ACTIVE/)
  })
})
