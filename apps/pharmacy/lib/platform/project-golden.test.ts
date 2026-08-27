import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  CAPABILITY_GATES,
  advertisedYesCount,
  comparisonCell,
} from "@synapse/config/gates"
import { COMPARISON_MATRIX } from "@synapse/config/comparison"
import { DEPLOYMENT_MODES, POSITIONING } from "@synapse/config/deployment-modes"
import { canAdvertiseAsLive, getCapability } from "@synapse/config/manifest"
import {
  FLAGSHIP_FHIR_RESOURCES,
  UNIMPLEMENTED_FHIR_RESOURCES,
  buildCapabilityStatement,
  buildRecommendation,
  classifyDenial,
  confirmIcd11Selection,
  createSimulationAdapter,
  createSimulationAdapterSet,
  recordClinicianDecision,
  scrubClaim,
  searchIcd11,
  stripInventedIcdCodes,
  suggestPathway,
  toFhirCondition,
  toFhirPatient,
  validateFhirResource,
} from "@synapse/interop"
import { PATHWAY_CATALOG } from "@synapse/db/pathways"
import { SimulationEngine } from "@synapse/db/simulation"
import { runOverlayGoldenJourney } from "@synapse/db/overlay-journey"

const ROOT = resolve(__dirname, "../../../..")

describe("PROJECT GOLDEN capability gates", () => {
  it("does not advertise any Synapse comparison cell as yes", () => {
    expect(advertisedYesCount()).toBe(0)
    expect(COMPARISON_MATRIX.every((row) => row.synapse !== "yes")).toBe(true)
    expect(COMPARISON_MATRIX.find((row) => row.id === "pharmacy-pos")?.synapse).toBe("partial")
    expect(COMPARISON_MATRIX.find((row) => row.id === "fhir-r4")?.synapse).toBe("partial")
    expect(COMPARISON_MATRIX.find((row) => row.id === "offline-first")?.synapse).toBe("partial")
  })

  it("never lets the landing page hardcode synapse yes/no cells", () => {
    const page = readFileSync(resolve(ROOT, "apps/web/src/app/page.tsx"), "utf8")
    expect(page).toContain("COMPARISON_MATRIX")
    expect(page).not.toMatch(/synapse:\s*['"]yes['"]/)
    expect(page).not.toMatch(/const COMPARE_ROWS/)
  })

  it("keeps liveEvidence false until production proof", () => {
    for (const gate of CAPABILITY_GATES) {
      expect(gate.liveEvidence).toBe(false)
      expect(comparisonCell(gate) === "yes").toBe(false)
    }
  })

  it("does not claim intelligence or FHIR as operational", () => {
    expect(canAdvertiseAsLive(getCapability("synapse-intelligence")!.status)).toBe(false)
    expect(getCapability("synapse-intelligence")?.status).toBe("development")
  })

  it("positions native, overlay and network modes", () => {
    expect(DEPLOYMENT_MODES.map((mode) => mode.id)).toEqual(["native", "overlay", "network"])
    expect(POSITIONING.promise).toContain("Intelligence")
  })
})

describe("intelligence kernel", () => {
  it("strips invented ICD codes and resolves candidates from terminology", () => {
    const recommendation = buildRecommendation({
      id: "r1",
      task: "clinical_copilot",
      packet: {
        patientId: "p1",
        tenantId: "t1",
        clinicianId: "c1",
        presentingComplaint: "Fever and chills",
        vitals: { rr: 32, spo2: 89 },
      },
      proposal: {
        conditionName: "Malaria due to Plasmodium falciparum",
        icd11Code: "ZZZZ",
        icd11Uri: "https://example.invalid/fake",
        cantMiss: true,
        confidence: 0.8,
      },
    })
    expect(stripInventedIcdCodes({ conditionName: "x", icd11Code: "ZZZZ" }).icd11Code).toBeNull()
    expect(recommendation.icd11Candidates[0]?.stemCode).toBe("1F40")
    expect(recommendation.icd11Candidates.every((hit) => hit.stemCode !== "ZZZZ")).toBe(true)
    expect(recommendation.suggestedPathwayId).toBe("pathway.malaria")
    expect(recommendation.provenance.promptVersion).toBe("golden.kernel.v1")
  })

  it("requires a reason for reject/modify and never auto-starts pathways", () => {
    expect(() =>
      recordClinicianDecision({
        recommendationId: "r1",
        decision: "REJECT",
        clinicianId: "c1",
      }),
    ).toThrow(/CLINICIAN_REASON_REQUIRED/)
    const accepted = recordClinicianDecision({
      recommendationId: "r1",
      decision: "ACCEPT",
      clinicianId: "c1",
    })
    expect(accepted.decision).toBe("ACCEPT")
    expect(suggestPathway(["adult sepsis"])).toBe("pathway.adult-sepsis")
  })
})

describe("ICD-11 terminology", () => {
  it("searches the 2026-01 cache and requires clinician confirmation", () => {
    const hits = searchIcd11("falciparum malaria")
    expect(hits[0]?.release).toBe("2026-01")
    expect(hits[0]?.classification).toBe("ICD-11 MMS")
    const coding = confirmIcd11Selection({
      entity: hits[0]!,
      selectedBy: "clinician",
      suggestedBy: "synapse_intelligence",
    })
    expect(coding.selectedBy).toBe("clinician")
    expect(coding.stemCode).toBeTruthy()
  })
})

describe("FHIR flagship set", () => {
  it("maps 11 resources and keeps CapabilityStatement honest", () => {
    expect(FLAGSHIP_FHIR_RESOURCES).toHaveLength(11)
    expect(UNIMPLEMENTED_FHIR_RESOURCES).toContain("Immunization")
    const statement = buildCapabilityStatement()
    expect(statement.status).toBe("draft")
    expect(statement.rest[0]?.resource.map((row) => row.type)).toEqual([...FLAGSHIP_FHIR_RESOURCES])
    expect(statement.rest[0]?.resource.some((row) => row.type === "Immunization")).toBe(false)
    const patient = toFhirPatient(
      {
        resourceType: "Person",
        id: "p1",
        synapseId: "SYN-UG-TEST",
        identifiers: [{ system: "mrn", value: "H1" }],
        name: { given: ["Demo"], text: "Demo Patient" },
        sex: "F",
      },
      "t1",
    )
    expect(validateFhirResource(patient)).toEqual([])
    const condition = toFhirCondition({
      id: "dx1",
      patientId: "p1",
      display: "Malaria due to Plasmodium falciparum",
      stemCode: "1F40",
      verificationStatus: "confirmed",
      tenantId: "t1",
      release: "2026-01",
    })
    expect(condition.resourceType).toBe("Condition")
  })
})

describe("claim scrubber", () => {
  it("blocks unverified ICD codes and never auto-submits", () => {
    const blocked = scrubClaim({
      diagnoses: [{ display: "Malaria", stemCode: "1F40", verified: false }],
      procedures: ["consult"],
      medications: [],
      charges: 10000,
      eligibilityCovered: true,
    })
    expect(blocked.autoSubmit).toBe(false)
    expect(blocked.readyForHumanReview).toBe(false)
    expect(blocked.errors.some((error) => error.includes("not clinician-verified"))).toBe(true)

    const ready = scrubClaim({
      diagnoses: [{ display: "Malaria", stemCode: "1F40", verified: true, release: "2026-01" }],
      procedures: ["consult"],
      medications: ["ALU"],
      charges: 10000,
      eligibilityCovered: true,
      documentation: ["encounter note"],
    })
    expect(ready.readyForHumanReview).toBe(true)
    expect(classifyDenial("invalid ICD code").category).toBe("coding")
  })
})

describe("adapter SDK", () => {
  it("labels overlay adapters as simulation and can inject faults", async () => {
    const adapters = createSimulationAdapterSet()
    expect(adapters.every((item) => item.identify().simulation)).toBe(true)
    expect(adapters.every((item) => item.health().status === "simulation")).toBe(true)
    const down = createSimulationAdapter("eafya", "timeout")
    const result = await down.pullPatients()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TIMEOUT")
  })
})

describe("pathways and overlay journey", () => {
  it("catalogs sepsis, malaria, DKA and pneumonia", () => {
    expect(PATHWAY_CATALOG.map((item) => item.id).sort()).toEqual(
      ["pathway.adult-sepsis", "pathway.dka", "pathway.malaria", "pathway.pneumonia"].sort(),
    )
  })

  it("runs malaria/dka/pneumonia simulations with lab and Rx events", () => {
    for (const scenario of ["opd-malaria", "dka", "pneumonia"] as const) {
      const engine = new SimulationEngine()
      const run = engine.run({
        seed: 20260829,
        scenario,
        tenantId: "00000000-0000-4000-8000-000000000001",
        tenantClassification: "demo",
        actorId: "clinician-1",
      })
      expect(run.carePlan?.pathwayId).toBeTruthy()
      expect(run.labOrder).toBeTruthy()
      expect(run.prescription).toBeTruthy()
      expect(run.status).toBe("completed")
    }
  })

  it("proves the overlay golden journey without inventing ICD codes", async () => {
    const result = await runOverlayGoldenJourney({
      tenantId: "00000000-0000-4000-8000-000000000001",
      clinicianId: "clinician-1",
    })
    expect(result.simulation).toBe(true)
    expect(result.pathwayId).toBe("pathway.malaria")
    expect(result.icd11.release).toBe("2026-01")
    expect(result.fhirPatientResourceType).toBe("Patient")
    expect(result.fhirObservationResourceType).toBe("Observation")
    expect(result.events).toContain("PatientRegistered")
    expect(result.events).toContain("LabResultVerified")
  })
})
