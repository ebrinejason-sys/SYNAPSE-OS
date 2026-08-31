import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertNoIdentifiableLeak,
  buildAggregateDataValueSet,
  fixtureAggregateFacts,
  stripIdentifiableFields,
} from "./privacy-export.ts"
import type { PatientContextPacket } from "../intelligence/kernel.ts"

const mappings = {
  orgUnits: [
    {
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      localOrgKey: "facility-kampala-01",
      dhis2OrgUnitId: "OU_KLA_01",
    },
  ],
  dataElements: [
    { icd11StemCode: "1F40", dhis2DataElementId: "DE_MALARIA_PF" },
    { icd11StemCode: "CA40", dhis2DataElementId: "DE_PNEUMONIA" },
    { icd11StemCode: "1B10", dhis2DataElementId: "DE_TB" },
  ],
}

describe("dhis2 privacy-export", () => {
  it("builds a stable DataValueSet from fixture facts", () => {
    const result = buildAggregateDataValueSet({
      source: fixtureAggregateFacts(),
      period: "202608",
      orgUnit: "OU_FALLBACK",
      orgUnitMappings: mappings.orgUnits,
      dataElementMappings: mappings.dataElements,
      capabilityGranted: true,
      mode: "simulation",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      result.dataValueSet.dataValues.map((v) => `${v.dataElement}:${v.orgUnit}:${v.period}:${v.value}`),
      ["DE_MALARIA_PF:OU_KLA_01:202608:4", "DE_PNEUMONIA:OU_KLA_01:202608:2", "DE_TB:OU_KLA_01:202608:1"],
    )
    assert.equal(assertNoIdentifiableLeak(result.dataValueSet).length, 0)
  })

  it("rejects when capability is denied", () => {
    const result = buildAggregateDataValueSet({
      source: fixtureAggregateFacts(),
      period: "202608",
      orgUnit: "OU_FALLBACK",
      orgUnitMappings: mappings.orgUnits,
      dataElementMappings: mappings.dataElements,
      capabilityGranted: false,
      mode: "simulation",
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, "CAPABILITY_DENIED")
  })

  it("blocks synthetic tenants from live mode", () => {
    const result = buildAggregateDataValueSet({
      source: fixtureAggregateFacts(),
      period: "202608",
      orgUnit: "OU_FALLBACK",
      orgUnitMappings: mappings.orgUnits,
      dataElementMappings: mappings.dataElements,
      capabilityGranted: true,
      mode: "live",
      isSyntheticTenant: true,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, "SYNTHETIC_LIVE_BLOCKED")
  })

  it("strips identifiers and never leaks packet fields into aggregates", () => {
    const dirty = {
      patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      displayName: "Jane Doe",
      count: 3,
      nested: { clinicianId: "x", value: 1 },
    }
    const clean = stripIdentifiableFields(dirty)
    assert.equal("patientId" in clean, false)
    assert.equal("displayName" in clean, false)
    assert.equal(clean.count, 3)
    assert.deepEqual(clean.nested, { value: 1 })

    const packet: PatientContextPacket = {
      patientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      facilityId: "facility-kampala-01",
      clinicianId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      presentingComplaint: "fever and cough — do not export",
      aggregatePeriod: "202608",
      demographics: { display: "Secret Name", age: 30, sex: "F" },
      confirmedDiagnoses: [
        { stemCode: "1F40", verified: true },
        { stemCode: "ZZZZ", verified: true },
      ],
    }

    const result = buildAggregateDataValueSet({
      source: [packet],
      period: "202608",
      orgUnit: "OU_FALLBACK",
      orgUnitMappings: mappings.orgUnits,
      dataElementMappings: mappings.dataElements,
      capabilityGranted: true,
      mode: "simulation",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    const json = JSON.stringify(result.dataValueSet)
    assert.equal(json.includes("Secret Name"), false)
    assert.equal(json.includes("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), false)
    assert.equal(json.includes("fever"), false)
    assert.equal(json.includes("ZZZZ"), false)
    assert.ok(result.dataValueSet.dataValues.some((v) => v.dataElement === "DE_MALARIA_PF" && v.value === "1"))
  })
})
