import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { generateSynapseId } from "./identity.ts"
import { runEhrContinuityGoldenJourney } from "./ehr-continuity-golden.ts"

describe("ehr-continuity-golden", () => {
  it("keeps one person across Hospital A, Lab B, and Pharmacy C and denies facility D", () => {
    const personId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const synapseId = generateSynapseId("UG")
    const result = runEhrContinuityGoldenJourney({ personId, synapseId })
    assert.equal(result.ok, true, JSON.stringify(result.steps.filter((s) => s.status === "FAIL"), null, 2))
    assert.equal(result.personId, personId)
    assert.equal(result.synapseId, synapseId)
    assert.equal(result.hospitalAMrn, "HOSP-A-1001")
    assert.equal(result.labBNumber, "LAB-B-4411")
    assert.equal(result.pharmacyCMrn, "PHARM-C-88")
    const ids = result.steps.map((s) => s.id)
    for (const required of [
      "person_identity",
      "facility_ids_are_aliases",
      "issuer_scoped_mrn",
      "no_auto_merge",
      "reception_encounter",
      "triage",
      "lab_order_from_hospital_a",
      "external_lab_b_release",
      "prescription_to_pharmacy_c",
      "pharmacy_c_dispense",
      "longitudinal_timeline",
      "authorized_hospital_a_access",
      "unauthorized_facility_d_denied",
    ]) {
      assert.ok(ids.includes(required), `missing ${required}`)
    }
    assert.ok(result.timeline.every((event) => event.personId === personId))
  })
})
