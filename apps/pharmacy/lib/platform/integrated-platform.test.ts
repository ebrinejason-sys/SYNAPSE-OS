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
  runMalariaLabSlice,
  MALARIA_PF_ANTIGEN_LOINC,
  MALARIA_PF_ANTIGEN_TEST_NAME,
  MALARIA_LAB_SLICE_EVENTS,
} from "@synapse/db/lab-workflow"
import { labResultToTimelineEvent } from "@synapse/db/timeline"
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
import {
  seedHospital,
  resetHospital,
  reseedHospital,
  HOSPITAL_CANONICAL_SLUG,
  HOSPITAL_CANONICAL_SEED,
} from "@synapse/db/hospital-seed"
import { WorkQueue, routeClinicalOrder } from "@synapse/db/work-queue"
import { buildDepartmentMatrix } from "@synapse/db/hospital-acceptance"

describe("product capability manifest", () => {
  it("does not advertise lab, FHIR, or imaging as live", () => {
    expect(getCapability("synapse-lab")?.status).toBe("development")
    expect(canAdvertiseAsLive(getCapability("synapse-lab")!.status)).toBe(false)
    expect(PRODUCT_MANIFEST.integrations.find((item) => item.id === "fhir-r4")?.status).toBe("development")
    expect(canAdvertiseAsLive("development")).toBe(false)
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
    expect(() => lab.enterResult({ resultId: "r2", orderId: "o2", value: "9" })).toThrow(
      /LAB_RESULT_LOCKED|LAB_ILLEGAL_TRANSITION/,
    )
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

describe("malaria lab vertical slice", () => {
  it("PASSes Positive Pf antigen through order→release with correlated events", () => {
    const slice = runMalariaLabSlice({
      tenantId: "t-malaria",
      patientId: "p-malaria",
      personId: "person-1",
      encounterId: "e-malaria",
      orderedBy: "clinician-1",
      verifierId: "lab-tech-1",
      correlationId: "corr-malaria-lab",
      accessionSeq: 42,
      value: "Positive",
      sex: "F",
      ageYears: 28,
    })
    expect(slice.result.resultValue).toBe("Positive")
    expect(slice.result.isAbnormal).toBe(true)
    expect(slice.result.flag).toBe("A")
    expect(slice.result.status).toBe("final")
    expect(slice.result.provenance).toBe("LAB_VERIFIED")
    expect(slice.order.status).toBe("RELEASED")
    expect(slice.order.loincCode).toBe(MALARIA_PF_ANTIGEN_LOINC)
    expect(slice.accession).toMatch(/^DEMO-\d{8}-00042$/)
    expect(slice.statuses).toEqual([
      "ORDERED",
      "COLLECTED",
      "RECEIVED",
      "VERIFICATION_PENDING",
      "VERIFIED",
      "RELEASED",
    ])
    expect(slice.events.map((e) => e.eventType)).toEqual([...MALARIA_LAB_SLICE_EVENTS])
    expect(slice.events.every((e) => e.correlationId === "corr-malaria-lab")).toBe(true)

    const timeline = labResultToTimelineEvent({
      tenantId: slice.order.tenantId,
      personId: slice.order.personId,
      patientId: slice.order.patientId,
      resultId: slice.result.id,
      orderId: slice.order.id,
      testName: slice.result.testName,
      loincCode: slice.result.loincCode,
      resultValue: slice.result.resultValue,
      flag: slice.result.flag,
      isAbnormal: slice.result.isAbnormal,
      accessionNumber: slice.accession,
      verifiedBy: slice.result.verifiedBy,
      verifiedAt: slice.result.verifiedAt,
    })
    expect(timeline.eventType).toBe("laboratory")
    expect(timeline.tags).toContain("malaria")
    expect(timeline.provenance).toBe("LAB_VERIFIED")
  })

  it("throws on illegal transitions with a clear error", () => {
    const lab = new LabWorkflow()
    lab.createOrder({
      id: "o-illegal",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      loincCode: MALARIA_PF_ANTIGEN_LOINC,
      testName: MALARIA_PF_ANTIGEN_TEST_NAME,
      urgency: "URGENT",
      status: "ORDERED",
      orderedBy: "doc",
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      correlationId: "c-illegal",
    })
    expect(() => lab.transition("o-illegal", "VERIFIED")).toThrow(/LAB_ILLEGAL_TRANSITION:ORDERED->VERIFIED/)
    expect(() => lab.verify("o-illegal", "lab-tech")).toThrow(/LAB_VERIFY_REFUSED/)
    expect(() => lab.verify("o-illegal", "ai-copilot")).toThrow(/LAB_AI_CANNOT_VERIFY/)
  })

  it("requires amend() — verified Positive cannot be silently overwritten", () => {
    const slice = runMalariaLabSlice({
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      orderedBy: "doc",
      verifierId: "lab-tech",
      correlationId: "c-lock",
      orderId: "o-lock",
      resultId: "r-lock",
    })
    expect(() =>
      slice.lab.enterResult({ resultId: "r-overwrite", orderId: "o-lock", value: "Negative" }),
    ).toThrow(/LAB_RESULT_LOCKED/)
    const amended = slice.lab.amend({
      amendmentId: "a-1",
      orderId: "o-lock",
      newValue: "Negative",
      reason: "Repeat RDT after QC review",
      amendedBy: "lab-tech",
    })
    expect(amended.result.version).toBe(2)
    expect(amended.result.status).toBe("amended")
    expect(amended.amendment.previousValue).toBe("Positive")
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

describe("hospital acceptance seed", () => {
  it("seeds SYNAPSE INTEGRATED REGIONAL HOSPITAL deterministically", () => {
    resetHospital(HOSPITAL_CANONICAL_SLUG)
    const a = seedHospital({ seed: HOSPITAL_CANONICAL_SEED, actorId: "test-admin" })
    const b = seedHospital({ seed: HOSPITAL_CANONICAL_SEED, actorId: "test-admin" })
    expect(a.tenantId).toBe(b.tenantId)
    expect(a.departments).toHaveLength(27)
    expect(a.locations).toHaveLength(28)
    expect(a.staff).toHaveLength(33)
    expect(a.patients).toHaveLength(10)
    expect(a.slug).toBe(HOSPITAL_CANONICAL_SLUG)
    expect(a.isSynthetic).toBe(true)
  })

  it("reseed produces fresh deterministic ids", () => {
    resetHospital(HOSPITAL_CANONICAL_SLUG)
    const first = seedHospital({ seed: HOSPITAL_CANONICAL_SEED, actorId: "test-admin" })
    const second = reseedHospital({ seed: HOSPITAL_CANONICAL_SEED, actorId: "test-admin" })
    expect(second.tenantId).toBe(first.tenantId)
    expect(second.patients[0]?.key).toBe("A")
  })

  it("department matrix is honest about NOT_IMPLEMENTED departments", () => {
    resetHospital(HOSPITAL_CANONICAL_SLUG)
    const hospital = seedHospital({ seed: HOSPITAL_CANONICAL_SEED, actorId: "test-admin" })
    const matrix = buildDepartmentMatrix(hospital)
    const emergency = matrix.find((d) => d.code === "emergency")
    expect(emergency?.status).toBe("NOT_IMPLEMENTED")
    const lab = matrix.find((d) => d.code === "laboratory")
    expect(lab?.status).toBe("PARTIAL")
  })
})

describe("work queue routing", () => {
  it("routes lab orders to laboratory department", () => {
    const queue = new WorkQueue()
    const result = routeClinicalOrder(queue, {
      orderType: "lab",
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      requesterId: "doc1",
      correlationId: "corr-1",
      title: "CBC",
      sourceResource: "lab_orders",
      sourceId: "lo1",
      isSynthetic: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.task.ownerDepartment).toBe("laboratory")
      expect(result.task.taskType).toBe("lab_order")
    }
  })

  it("deduplicates via idempotency key", () => {
    const queue = new WorkQueue()
    const params = {
      orderType: "prescription" as const,
      tenantId: "t1",
      patientId: "p1",
      encounterId: "e1",
      requesterId: "doc1",
      correlationId: "corr-1",
      title: "Artemether",
      sourceResource: "clinical_prescriptions",
      sourceId: "rx1",
    }
    const first = routeClinicalOrder(queue, params)
    const second = routeClinicalOrder(queue, params)
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.task.id).toBe(second.task.id)
    }
  })
})

describe("edge architecture honesty", () => {
  it("does not claim offline checkout", () => {
    expect(describeEdgeReadiness().pharmacyWebCheckout.status).toBe("disabled")
    expect(describeEdgeReadiness().status).toBe("roadmap")
  })
})
