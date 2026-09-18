import { describe, expect, it } from "vitest"
import { buildCapabilityStatement, PROVEN_FHIR_RESOURCES, FLAGSHIP_FHIR_RESOURCES, isProvenFhirResource, classifyFhirHttpType } from "./r4"

describe("FHIR CapabilityStatement truth", () => {
  it("advertises only the proven lab-backed subset", () => {
    const statement = buildCapabilityStatement(new Date("2026-09-18T00:00:00Z"))
    expect(statement.rest[0]?.resource.map((row) => row.type)).toEqual([...PROVEN_FHIR_RESOURCES])
    expect(isProvenFhirResource("Patient")).toBe(false)
    expect(FLAGSHIP_FHIR_RESOURCES).toContain("Patient")
    expect(statement.rest[0]?.resource.some((row) => row.type === "Encounter")).toBe(false)
  })

  it("classifies Patient/Encounter as unproven HTTP and lab resources as proven", () => {
    expect(classifyFhirHttpType("Observation")).toBe("proven")
    expect(classifyFhirHttpType("Specimen")).toBe("proven")
    expect(classifyFhirHttpType("DiagnosticReport")).toBe("proven")
    expect(classifyFhirHttpType("Patient")).toBe("flagship_unproven")
    expect(classifyFhirHttpType("Encounter")).toBe("flagship_unproven")
    expect(classifyFhirHttpType("Immunization")).toBe("unimplemented")
    expect(classifyFhirHttpType("ExplanationOfBenefit")).toBe("unknown")
  })
})
