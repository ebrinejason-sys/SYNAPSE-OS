import { describe, expect, it } from "vitest"
import {
  PRODUCT_MANIFEST,
  canAdvertiseAsLive,
  getCapability,
  integrationLabel,
  statusLabel,
} from "@synapse/config/manifest"
import { ExchangeOutbox } from "@synapse/db/exchange"
import {
  LabWorkflow,
  canTransitionLabStatus,
  interpretResult,
} from "@synapse/db/lab-workflow"
import {
  PathwayRuntime,
  SEPSIS_PATHWAY,
  instantiateCarePlan,
} from "@synapse/db/pathways"
import {
  SimulationEngine,
  assertDemoResetAllowed,
  mulberry32,
  uuidFromRng,
} from "@synapse/db/simulation"
import {
  assertDispensePermission,
  createPrescription,
  dispensePrescription,
  verifyPrescription,
} from "@synapse/db/prescription-bridge"
import { addAlias, createCrosswalk, facilityMrn } from "@synapse/db/identity-crosswalk"
import { shouldAutoMerge } from "@synapse/db/mpi"
import { localMrnIdentifier } from "@synapse/db/identity"
import { describeEdgeReadiness } from "@synapse/db/edge-architecture"

describe("product capability manifest", () => {
  it("does not advertise lab, FHIR, or imaging as live", () => {
    expect(getCapability("synapse-lab")?.status).toBe("development")
    expect(canAdvertiseAsLive(getCapability("synapse-lab")!.status)).toBe(false)
    expect(PRODUCT_MANIFEST.integrations.find((item) => item.id === "fhir-r4")?.status).toBe("roadmap")
    expect(integrationLabel("roadmap")).toBe("ROADMAP")
    expect(statusLabel("operational_candidate")).toBe("Operational candidate")
  })

  it("keeps pharmacy as operational candidate, not operational", () => {
    expect(getCapability("synapse-pharm")?.status).toBe("operational_candidate")
  })
})

describe("identity crosswalk", () => {
  it("keeps facility MRNs as aliases, not the canonical key", () => {
    const crosswalk = createCrosswalk("person-1", "SYN-UG-TEST")
    const withMrn = addAlias(
      crosswalk,
      localMrnIdentifier({ mrn: "HOSP-1", facilityId: "facility-a" }),
      true,
    )
    expect(withMrn.personId).toBe("person-1")
    expect(facilityMrn(withMrn, "facility-a")).toBe("HOSP-1")
    expect(facilityMrn(withMrn, "facility-b")).toBeNull()
  })

  it("never auto-merges", () => {
    expect(shouldAutoMerge({ recommendation: "auto_link_identifier" } as never)).toBe(false)
  })
})

describe("exchange outbox", () => {
  it("is idempotent and traces a correlation chain", () => {
    const outbox = new ExchangeOutbox()
    const a = outbox.append({
      eventType: "EncounterCreated",
      tenantId: "t1",
      correlationId: "c1",
      payload: { n: 1 },
      source: "synapse-os",
      aggregateId: "enc-1",
      action: "create",
    })
    const dup = outbox.append({
      eventType: "EncounterCreated",
      tenantId: "t1",
      correlationId: "c1",
      payload: { n: 99 },
      source: "synapse-os",
      aggregateId: "enc-1",
      action: "create",
    })
    expect(dup.event_id).toBe(a.event_id)
    outbox.append({
      eventType: "LabOrderCreated",
      tenantId: "t1",
      correlationId: "c1",
      causationId: a.event_id,
      payload: {},
      source: "synapse-lab",
      aggregateId: "lab-1",
      action: "create",
    })
    expect(outbox.chain("c1").map((event) => event.event_type)).toEqual([
      "EncounterCreated",
      "LabOrderCreated",
    ])
    const failed = outbox.markFailed(a.idempotency_key, "network", 2)
    expect(failed?.status).toBe("failed")
    expect(outbox.retry(a.idempotency_key)?.status).toBe("pending")
    expect(outbox.markPublished(a.idempotency_key)?.status).toBe("published")
  })
})

describe("lab workflow", () => {
  it("walks order to verified result and blocks illegal transitions", () => {
    const lab = new LabWorkflow()
    lab.createOrder({
      id: "o1",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      loincCode: "2524-7",
      testName: "Lactate",
      urgency: "STAT",
      status: "ORDERED",
      orderedBy: "doc",
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      correlationId: "c1",
    })
    expect(canTransitionLabStatus("ORDERED", "VERIFIED")).toBe(false)
    lab.transition("o1", "COLLECTION_PENDING")
    lab.collect("o1", "DEMO-20260827-00001", "DEMO2026082700001", "s1")
    lab.receive("o1")
    const { result } = lab.enterResult({ resultId: "r1", orderId: "o1", value: "6.2", ageYears: 40 })
    expect(result.isCritical).toBe(true)
    expect(result.status).toBe("preliminary")
    const verified = lab.verify("o1", "lab-tech")
    expect(verified.status).toBe("final")
    expect(verified.provenance).toBe("LAB_VERIFIED")
    lab.release("o1")
    const amended = lab.amend({
      amendmentId: "a1",
      orderId: "o1",
      newValue: "6.0",
      reason: "re-run after hemolysis check",
      amendedBy: "lab-tech",
    })
    expect(amended.result.version).toBe(2)
    expect(amended.result.status).toBe("amended")
    expect(amended.amendment.previousValue).toBe("6.2")
    lab.acknowledgeCritical({ id: "ack1", orderId: "o1", acknowledgedBy: "doctor" })
  })

  it("rejects silent overwrite of verified results via enterResult path", () => {
    expect(interpretResult({ loincCode: "2524-7", value: "1.2" }).flag).toBe("N")
    const lab = new LabWorkflow()
    lab.createOrder({
      id: "o2",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      loincCode: "2524-7",
      testName: "Lactate",
      urgency: "STAT",
      status: "ORDERED",
      orderedBy: "doc",
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      correlationId: "c1",
    })
    lab.transition("o2", "COLLECTION_PENDING")
    lab.collect("o2", "A", "A", "s")
    lab.receive("o2")
    lab.enterResult({ resultId: "r", orderId: "o2", value: "1.1" })
    lab.verify("o2", "v")
    expect(() => lab.enterResult({ resultId: "r2", orderId: "o2", value: "9" })).toThrow(/LAB_ILLEGAL_TRANSITION/)
  })

  it("rejects a specimen with a reason", () => {
    const lab = new LabWorkflow()
    lab.createOrder({
      id: "o3",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      loincCode: "2524-7",
      testName: "Lactate",
      urgency: "STAT",
      status: "ORDERED",
      orderedBy: "doc",
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      correlationId: "c1",
    })
    lab.transition("o3", "COLLECTION_PENDING")
    lab.collect("o3", "B", "B", "s")
    lab.reject("o3", "hemolyzed", "gross hemolysis")
    expect(lab.getOrder("o3").status).toBe("REJECTED")
  })
})

describe("clinical pathways", () => {
  it("freezes pathway version and records overrides without training flags", () => {
    const runtime = new PathwayRuntime()
    const plan = runtime.start(
      instantiateCarePlan({
        id: "cp1",
        tenantId: "t1",
        patientId: "p1",
        encounterId: "e1",
        pathway: SEPSIS_PATHWAY,
        correlationId: "c1",
        isSynthetic: true,
      }),
    )
    expect(plan.pathwayVersion).toBe(SEPSIS_PATHWAY.version)
    runtime.completeStep({ carePlanId: "cp1", stepId: "assess" })
    const { override } = runtime.overrideStep({
      overrideId: "ov1",
      carePlanId: "cp1",
      stepId: "investigate",
      actualAction: "Deferred lactate — clinician treating empirically first",
      reason: "Access to lab delayed; source control started",
      clinicianId: "doc-1",
      patientContextReference: "encounter:e1",
    })
    expect(override.mayTrainModels).toBe(false)
    expect(override.pathwayVersion).toBe("1.0.0")
    expect(() =>
      runtime.overrideStep({
        overrideId: "ov2",
        carePlanId: "cp1",
        stepId: "treat",
        actualAction: "skip",
        reason: "   ",
        clinicianId: "doc-1",
        patientContextReference: "encounter:e1",
      }),
    ).toThrow("OVERRIDE_REASON_REQUIRED")
  })
})

describe("prescription bridge", () => {
  it("keeps prescribe and dispense as separate permissions and decrements stock", () => {
    expect(() => assertDispensePermission("doctor")).toThrow("DISPENSE_PERMISSION_DENIED")
    const rx = createPrescription({
      id: "rx1",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      medicationDisplay: "Ceftriaxone 2 g IV",
      dose: "2 g",
      quantity: 1,
      unit: "vial",
      prescriberId: "doc-1",
      status: "active",
      isSynthetic: true,
      correlationId: "c1",
    })
    expect(() =>
      dispensePrescription({ rx, dispenserId: "pharm-1", role: "pharmacist", availableStock: 10 }),
    ).toThrow("DISPENSE_REQUIRES_VERIFICATION")
    const verified = verifyPrescription(rx, "pharm-1", "pharmacist")
    const dispensed = dispensePrescription({
      rx: verified,
      dispenserId: "pharm-1",
      role: "pharmacist",
      availableStock: 10,
    })
    expect(dispensed.remainingStock).toBe(9)
    expect(dispensed.rx.status).toBe("dispensed")
  })
})

describe("simulation engine", () => {
  it("reproduces the sepsis journey for the same seed", () => {
    const a = new SimulationEngine().run({
      seed: 20260829,
      scenario: "sepsis-critical-lab",
      tenantId: "demo-hospital",
      tenantClassification: "demo",
      actorId: "clinician-1",
    })
    const b = new SimulationEngine().run({
      seed: 20260829,
      scenario: "sepsis-critical-lab",
      tenantId: "demo-hospital",
      tenantClassification: "demo",
      actorId: "clinician-1",
    })
    expect(a.patient?.synapseId).toBe(b.patient?.synapseId)
    expect(a.patient?.demographics.fullName).toContain("Demo")
    expect(a.labOrder?.loincCode).toBe("2524-7")
    expect(a.prescription?.medicationDisplay).toMatch(/Ceftriaxone/)
    expect(a.dispense?.remainingStock).toBe(23)
    expect(a.is_synthetic).toBe(true)
    expect(a.data_classification).toBe("synthetic")
    const types = new SimulationEngine()
      .run({
        seed: 20260829,
        scenario: "sepsis-critical-lab",
        tenantId: "demo-hospital",
        tenantClassification: "demo",
        actorId: "clinician-1",
      })
      .id
    expect(types).toBe(a.id)
    const engine = new SimulationEngine()
    engine.run({
      seed: 20260829,
      scenario: "sepsis-critical-lab",
      tenantId: "demo-hospital",
      tenantClassification: "demo",
      actorId: "clinician-1",
    })
    const chain = engine.outbox.chain(engine.runs[0]!.correlationId).map((event) => event.event_type)
    expect(chain).toContain("LabOrderCreated")
    expect(chain).toContain("LabResultVerified")
    expect(chain).toContain("CriticalLabResultDetected")
    expect(chain).toContain("CriticalLabResultAcknowledged")
    expect(chain).toContain("PrescriptionCreated")
    expect(chain).toContain("MedicationDispensed")
    expect(chain.indexOf("EncounterCreated")).toBeLessThan(chain.indexOf("LabOrderCreated"))
    expect(chain.indexOf("LabResultVerified")).toBeLessThan(chain.indexOf("MedicationDispensed"))
  })

  it("refuses to run or reset production tenants", () => {
    const engine = new SimulationEngine()
    expect(() =>
      engine.run({
        seed: 1,
        scenario: "sepsis-critical-lab",
        tenantId: "prod",
        tenantClassification: "production",
        actorId: "x",
      }),
    ).toThrow("SIMULATION_FORBIDDEN_ON_PRODUCTION")
    expect(() =>
      assertDemoResetAllowed({ classification: "production", isSynthetic: true }),
    ).toThrow("SIMULATION_RESET_BLOCKED_PRODUCTION")
    expect(() =>
      assertDemoResetAllowed({ classification: "demo", isSynthetic: false }),
    ).toThrow("SIMULATION_RESET_REQUIRES_DEMO_TENANT")
  })

  it("can pause at the lab order for a human vertical slice", () => {
    const engine = new SimulationEngine()
    const run = engine.run({
      seed: 7,
      scenario: "sepsis-critical-lab",
      tenantId: "demo-hospital",
      tenantClassification: "demo",
      actorId: "clinician-1",
      pauseAt: "lab_order",
    })
    expect(run.status).toBe("paused")
    expect(run.labOrder?.status).toBe("COLLECTION_PENDING")
    expect(run.prescription).toBeUndefined()
  })

  it("uses a deterministic RNG", () => {
    const a = mulberry32(20260829)
    const b = mulberry32(20260829)
    expect(uuidFromRng(a)).toBe(uuidFromRng(b))
  })
})

describe("edge architecture honesty", () => {
  it("does not claim offline checkout", () => {
    expect(describeEdgeReadiness().pharmacyWebCheckout.status).toBe("disabled")
    expect(describeEdgeReadiness().status).toBe("roadmap")
  })
})
