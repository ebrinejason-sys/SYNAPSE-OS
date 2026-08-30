/**
 * Deterministic synthetic healthcare data engine.
 * Synthetic records are always marked. Production tenants cannot be reset.
 */

import { generateSynapseId, localMrnIdentifier, type PersonDemographics } from "./identity"
import { ExchangeOutbox } from "./exchange"
import {
  LabWorkflow,
  barcodeFromAccession,
  formatAccession,
  type LabOrder,
} from "./lab-workflow"
import {
  PathwayRuntime,
  SEPSIS_PATHWAY,
  DKA_PATHWAY,
  PNEUMONIA_PATHWAY,
  instantiateCarePlan,
  type ClinicalPathwayDefinition,
  type PatientCarePlan,
} from "./pathways"
import {
  pharmacyDispenseTimelineEvent,
  toTimelineInsert,
  type TimelineEventInput,
} from "./timeline"
import { executeMalariaGoldenJourney } from "./malaria-golden-journey"

export const SYNTHETIC_CLASSIFICATION = "synthetic" as const

export const SCENARIO_IDS = [
  "opd-malaria",
  "pneumonia",
  "dka",
  "sepsis-critical-lab",
  "pharmacy-retail",
  "stockout",
  "insurance-claim",
  "referral",
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export type DemoTenantKind = "hospital" | "pharmacy" | "laboratory" | "health_centre"

export type TenantClassification = "demo" | "production" | "staging"

export type SyntheticMarkers = {
  is_synthetic: true
  data_classification: typeof SYNTHETIC_CLASSIFICATION
  simulation_run_id: string
}

export type SimulationPatient = {
  id: string
  personId: string
  synapseId: string
  mrn: string
  demographics: Required<Pick<PersonDemographics, "fullName" | "dateOfBirth" | "sex">> & {
    givenName: string
    familyName: string
    phone: string
  }
  aliases: ReturnType<typeof localMrnIdentifier>[]
} & SyntheticMarkers

export type SimulationEncounter = {
  id: string
  tenantId: string
  patientId: string
  personId: string
  status: "open" | "signed"
  encounterType: "OPD" | "EMERGENCY" | "IPD"
  chiefComplaint: string
  vitals: Record<string, number>
} & SyntheticMarkers

export type SimulationPrescription = {
  id: string
  tenantId: string
  patientId: string
  encounterId: string
  medicationDisplay: string
  dose: string
  quantity: number
  status: "active" | "verified" | "dispensed"
  prescriberId: string
} & SyntheticMarkers

export type SimulationDispense = {
  id: string
  prescriptionId: string
  tenantId: string
  productName: string
  quantity: number
  batch: string
  remainingStock: number
} & SyntheticMarkers

export type SimulationRun = {
  id: string
  seed: number
  scenario: ScenarioId
  tenantId: string
  tenantKind: DemoTenantKind
  tenantClassification: TenantClassification
  actorId: string
  correlationId: string
  createdAt: string
  status: "running" | "paused" | "completed" | "failed"
  pauseAt?: string | null
  patient?: SimulationPatient
  encounter?: SimulationEncounter
  carePlan?: PatientCarePlan
  labOrder?: LabOrder
  prescription?: SimulationPrescription
  dispense?: SimulationDispense
  timeline: TimelineEventInput[]
  notes: string[]
} & SyntheticMarkers

export type SimulationEngineOptions = {
  seed: number
  scenario: ScenarioId
  tenantId: string
  tenantKind?: DemoTenantKind
  tenantClassification: TenantClassification
  actorId: string
  patientCount?: number
  pauseAt?: "lab_order" | "result_entry" | "prescription" | null
  now?: Date
  outbox?: ExchangeOutbox
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function uuidFromRng(rng: () => number): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rng() * 256))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function entropyFromRng(rng: () => number): Uint8Array {
  return Uint8Array.from({ length: 5 }, () => Math.floor(rng() * 256))
}

const DEMO_NAMES = [
  { given: "Demo Amina", family: "Nalubega" },
  { given: "Demo Joseph", family: "Okello" },
  { given: "Demo Sarah", family: "Atim" },
  { given: "Demo Peter", family: "Mugisha" },
  { given: "Demo Grace", family: "Namukasa" },
] as const

export function assertDemoResetAllowed(tenant: {
  classification: TenantClassification
  isSynthetic?: boolean
}): void {
  if (tenant.classification === "production") {
    throw new Error("SIMULATION_RESET_BLOCKED_PRODUCTION")
  }
  if (tenant.classification !== "demo" || tenant.isSynthetic !== true) {
    throw new Error("SIMULATION_RESET_REQUIRES_DEMO_TENANT")
  }
}

function markers(runId: string): SyntheticMarkers {
  return {
    is_synthetic: true,
    data_classification: SYNTHETIC_CLASSIFICATION,
    simulation_run_id: runId,
  }
}

function timeline(
  run: Pick<SimulationRun, "tenantId" | "patient" | "id">,
  eventType: TimelineEventInput["eventType"],
  title: string,
  summary: string,
  sourceTable: string,
  sourceId: string,
): TimelineEventInput {
  return {
    personId: run.patient?.personId ?? null,
    patientId: run.patient?.id ?? null,
    tenantId: run.tenantId,
    eventType,
    title,
    summary,
    eventDate: new Date().toISOString(),
    sourceTable,
    sourceId,
    provenance: "SYSTEM_GENERATED",
    payload: { simulation_run_id: run.id, is_synthetic: true },
    tags: ["synthetic", eventType],
  }
}

export class SimulationEngine {
  readonly outbox: ExchangeOutbox
  readonly lab: LabWorkflow
  readonly pathways: PathwayRuntime
  readonly runs: SimulationRun[] = []

  constructor(outbox = new ExchangeOutbox()) {
    this.outbox = outbox
    this.lab = new LabWorkflow()
    this.pathways = new PathwayRuntime()
  }

  run(options: SimulationEngineOptions): SimulationRun {
    if (options.tenantClassification === "production") {
      throw new Error("SIMULATION_FORBIDDEN_ON_PRODUCTION")
    }
    const rng = mulberry32(options.seed)
    const runId = uuidFromRng(rng)
    const correlationId = uuidFromRng(rng)
    const now = options.now ?? new Date()
    const mark = markers(runId)
    const run: SimulationRun = {
      id: runId,
      seed: options.seed,
      scenario: options.scenario,
      tenantId: options.tenantId,
      tenantKind: options.tenantKind ?? "hospital",
      tenantClassification: options.tenantClassification,
      actorId: options.actorId,
      correlationId,
      createdAt: now.toISOString(),
      status: "running",
      pauseAt: options.pauseAt ?? null,
      timeline: [],
      notes: [],
      ...mark,
    }
    this.runs.push(run)
    this.emit(run, "SimulationRunStarted", "synapse-simulation", run.id, "start", {
      scenario: options.scenario,
      seed: options.seed,
    })

    try {
      switch (options.scenario) {
        case "sepsis-critical-lab":
          this.runSepsis(run, rng, options)
          break
        case "opd-malaria":
          this.runMalaria(run, rng, options)
          break
        case "pneumonia":
          this.runNamedPathway(run, rng, options, PNEUMONIA_PATHWAY, {
            type: "OPD",
            chiefComplaint: "Cough, fever and fast breathing",
            vitals: { temp: 38.4, hr: 110, sbp: 118, rr: 32, spo2: 89 },
            loinc: "6690-2",
            testName: "WBC",
            value: "18.2",
            medication: "Amoxicillin 500 mg PO",
          })
          break
        case "dka":
          this.runNamedPathway(run, rng, options, DKA_PATHWAY, {
            type: "EMERGENCY",
            chiefComplaint: "Polyuria, vomiting and Kussmaul breathing",
            vitals: { temp: 37.1, hr: 128, sbp: 98, rr: 28, spo2: 96 },
            loinc: "2345-7",
            testName: "Glucose",
            value: "28.4",
            medication: "Soluble insulin IV protocol",
          })
          break
        case "pharmacy-retail":
        case "stockout":
        case "insurance-claim":
        case "referral":
          this.runStubScenario(run, rng, options)
          break
      }
      if (run.status === "running") run.status = "completed"
      this.emit(run, "SimulationRunCompleted", "synapse-simulation", run.id, "complete", {
        scenario: options.scenario,
        status: run.status,
      })
      return run
    } catch (error) {
      run.status = "failed"
      run.notes.push(error instanceof Error ? error.message : "simulation_failed")
      throw error
    }
  }

  resetDemoTenant(tenant: { id: string; classification: TenantClassification; isSynthetic: boolean }): string[] {
    assertDemoResetAllowed(tenant)
    const removed = this.runs.filter((run) => run.tenantId === tenant.id).map((run) => run.id)
    for (let i = this.runs.length - 1; i >= 0; i--) {
      if (this.runs[i]?.tenantId === tenant.id) this.runs.splice(i, 1)
    }
    return removed
  }

  private runSepsis(run: SimulationRun, rng: () => number, options: SimulationEngineOptions) {
    this.registerPatient(run, rng, 0)
    this.startEncounter(run, rng, {
      type: "EMERGENCY",
      chiefComplaint: "Fever, confusion, and low blood pressure",
      vitals: { temp: 39.1, hr: 124, sbp: 88, rr: 28, spo2: 91 },
    })
    const pathway = SEPSIS_PATHWAY
    const carePlan = instantiateCarePlan({
      id: uuidFromRng(rng),
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      personId: run.patient!.personId,
      encounterId: run.encounter!.id,
      pathway,
      isSynthetic: true,
      simulationRunId: run.id,
      correlationId: run.correlationId,
    })
    this.pathways.start(carePlan)
    run.carePlan = carePlan
    this.emit(run, "ClinicalPathwayStarted", "synapse-pathways", carePlan.id, "start", {
      pathwayId: pathway.id,
      pathwayVersion: pathway.version,
      sourceId: pathway.source.id,
    })
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "assess",
      actualAction: "Clinician confirmed suspected sepsis and started the pathway",
    })
    this.emit(run, "ClinicalPathwayStepCompleted", "synapse-pathways", carePlan.id, "assess", {
      stepId: "assess",
      pathwayVersion: pathway.version,
    })

    const orderId = uuidFromRng(rng)
    const accession = formatAccession("DEMO", Math.floor(rng() * 90000) + 1, options.now)
    const order: LabOrder = {
      id: orderId,
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      personId: run.patient!.personId,
      encounterId: run.encounter!.id,
      carePlanId: carePlan.id,
      loincCode: "2524-7",
      testName: "Lactate",
      urgency: "STAT",
      status: "ORDERED",
      orderedBy: options.actorId,
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      simulationRunId: run.id,
      correlationId: run.correlationId,
    }
    this.lab.createOrder(order)
    this.lab.transition(order.id, "COLLECTION_PENDING")
    run.labOrder = order
    this.emit(run, "LabOrderCreated", "synapse-lab", order.id, "create", {
      loincCode: order.loincCode,
      testName: order.testName,
      urgency: order.urgency,
    })
    this.pushTimeline(run, "laboratory", "STAT lactate ordered", "Sepsis pathway investigation", "lab_orders", order.id)
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "investigate",
      actualAction: "STAT lactate ordered via Synapse Lab",
    })

    if (options.pauseAt === "lab_order") {
      run.status = "paused"
      run.notes.push("Paused after lab order for human specimen workflow")
      return
    }

    this.lab.collect(order.id, accession, barcodeFromAccession(accession), uuidFromRng(rng))
    this.emit(run, "SpecimenCollected", "synapse-lab", order.id, "collect", { accession })
    this.lab.receive(order.id)
    this.emit(run, "SpecimenReceived", "synapse-lab", order.id, "receive", { accession })

    if (options.pauseAt === "result_entry") {
      run.status = "paused"
      run.notes.push("Paused after specimen receipt for human result entry")
      return
    }

    const entered = this.lab.enterResult({
      resultId: uuidFromRng(rng),
      orderId: order.id,
      value: "6.2",
      analyzer: "DEMO-ABL-90",
      sex: run.patient!.demographics.sex,
      ageYears: 42,
    })
    this.emit(run, "LabResultEntered", "synapse-lab", entered.result.id, "enter", {
      value: entered.result.resultValue,
      flag: entered.result.flag,
    })
    const verified = this.lab.verify(order.id, options.actorId)
    this.emit(run, "LabResultVerified", "synapse-lab", verified.id, "verify", {
      value: verified.resultValue,
      isCritical: verified.isCritical,
    })
    this.lab.release(order.id)
    this.emit(run, "LabResultReleased", "synapse-lab", verified.id, "release", {
      value: verified.resultValue,
      accession,
    })
    this.pushTimeline(
      run,
      "laboratory",
      "Lactate verified 6.2 mmol/L (critical)",
      `Reference ${verified.referenceRange}`,
      "lab_results",
      verified.id,
    )
    if (verified.isCritical) {
      this.emit(run, "CriticalLabResultDetected", "synapse-lab", verified.id, "critical", {
        value: verified.resultValue,
        unit: verified.unit,
      })
      this.lab.acknowledgeCritical({
        id: uuidFromRng(rng),
        orderId: order.id,
        acknowledgedBy: options.actorId,
        note: "Clinician acknowledged critical lactate",
      })
      this.emit(run, "CriticalLabResultAcknowledged", "synapse-os", verified.id, "ack", {
        acknowledgedBy: options.actorId,
      })
    }
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "interpret",
      actualAction: "Critical lactate acknowledged by clinician",
    })

    if (options.pauseAt === "prescription") {
      run.status = "paused"
      return
    }

    const prescription: SimulationPrescription = {
      id: uuidFromRng(rng),
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      encounterId: run.encounter!.id,
      medicationDisplay: "Ceftriaxone 2 g IV",
      dose: "2 g",
      quantity: 1,
      status: "active",
      prescriberId: options.actorId,
      ...markers(run.id),
    }
    run.prescription = prescription
    this.emit(run, "PrescriptionCreated", "synapse-os", prescription.id, "create", {
      medicationDisplay: prescription.medicationDisplay,
    })
    this.pushTimeline(
      run,
      "prescription",
      "Ceftriaxone 2 g IV prescribed",
      "Clinician confirmed pathway recommendation",
      "hospital_drug_orders",
      prescription.id,
    )
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "treat",
      actualAction: "Ceftriaxone prescribed after clinician confirmation",
    })

    this.emit(run, "PrescriptionVerified", "synapse-pharm", prescription.id, "verify", {
      medicationDisplay: prescription.medicationDisplay,
    })
    prescription.status = "verified"
    const remainingStock = 24
    const dispense: SimulationDispense = {
      id: uuidFromRng(rng),
      prescriptionId: prescription.id,
      tenantId: run.tenantId,
      productName: prescription.medicationDisplay,
      quantity: 1,
      batch: "DEMO-CEF-202608",
      remainingStock: remainingStock - 1,
      ...markers(run.id),
    }
    run.dispense = dispense
    prescription.status = "dispensed"
    this.emit(run, "MedicationDispensed", "synapse-pharm", dispense.id, "dispense", {
      quantity: 1,
      remainingStock: dispense.remainingStock,
      batch: dispense.batch,
    })
    const dispenseEvent = pharmacyDispenseTimelineEvent({
      tenantId: run.tenantId,
      personId: run.patient!.personId,
      patientId: run.patient!.id,
      saleId: dispense.id,
      receiptNumber: `SYN-DEMO-${dispense.id.slice(0, 8)}`,
      facilityName: "SYNAPSE DEMO HOSPITAL",
      itemSummary: `${dispense.productName} x${dispense.quantity}`,
      createdBy: options.actorId,
    })
    run.timeline.push(dispenseEvent)
    toTimelineInsert(dispenseEvent)
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "dispense",
      actualAction: "Pharmacist verified and dispensed ceftriaxone; stock decremented",
    })
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "monitor",
      actualAction: "Repeat observations scheduled",
    })
    this.pathways.completeStep({
      carePlanId: carePlan.id,
      stepId: "outcome",
      actualAction: "Pathway in progress with antimicrobial given",
    })
    this.pathways.recordOutcome(carePlan.id, "antimicrobial_administered")
    run.carePlan = this.pathways.get(carePlan.id)
    this.emit(run, "ClinicalPathwayCompleted", "synapse-pathways", carePlan.id, "complete", {
      outcome: run.carePlan.outcome,
      pathwayVersion: pathway.version,
    })
  }

  private runMalaria(run: SimulationRun, rng: () => number, options: SimulationEngineOptions) {
    const result = executeMalariaGoldenJourney({
      tenantId: run.tenantId,
      clinicianId: options.actorId,
      seed: options.seed,
      outbox: this.outbox,
      lab: this.lab,
      pathways: this.pathways,
      runId: run.id,
      correlationId: run.correlationId,
      rng,
      now: options.now,
      skipRunLifecycleEvents: true,
    })
    if (result.entities) {
      run.patient = result.entities.patient as SimulationPatient
      run.encounter = result.entities.encounter as SimulationEncounter
      run.carePlan = result.entities.carePlan
      run.labOrder = result.entities.labOrder
      run.prescription = result.entities.prescription as SimulationPrescription
      run.dispense = result.entities.dispense as SimulationDispense
      run.timeline.push(...result.entities.timeline)
    }
    if (result.status === "FAIL") {
      run.notes.push(result.error ?? "malaria_golden_journey_failed")
      throw new Error(result.error ?? "MALARIA_GOLDEN_JOURNEY_FAILED")
    }
  }

  private runNamedPathway(
    run: SimulationRun,
    rng: () => number,
    options: SimulationEngineOptions,
    pathway: ClinicalPathwayDefinition,
    input: {
      type: SimulationEncounter["encounterType"]
      chiefComplaint: string
      vitals: Record<string, number>
      loinc: string
      testName: string
      value: string
      medication: string
    },
  ) {
    this.registerPatient(run, rng, Math.floor(rng() * DEMO_NAMES.length))
    this.startEncounter(run, rng, {
      type: input.type,
      chiefComplaint: input.chiefComplaint,
      vitals: input.vitals,
    })
    this.activatePathway(run, rng, pathway)
    const orderId = uuidFromRng(rng)
    const accession = formatAccession("DEMO", Math.floor(rng() * 90000) + 1, options.now)
    const order: LabOrder = {
      id: orderId,
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      personId: run.patient!.personId,
      encounterId: run.encounter!.id,
      loincCode: input.loinc,
      testName: input.testName,
      urgency: "STAT",
      status: "ORDERED",
      orderedBy: options.actorId,
      orderedAt: new Date().toISOString(),
      isSynthetic: true,
      simulationRunId: run.id,
      correlationId: run.correlationId,
    }
    this.lab.createOrder(order)
    this.lab.transition(order.id, "COLLECTION_PENDING")
    this.lab.collect(order.id, accession, barcodeFromAccession(accession), uuidFromRng(rng))
    this.lab.receive(order.id)
    this.lab.enterResult({
      resultId: uuidFromRng(rng),
      orderId: order.id,
      value: input.value,
      sex: run.patient!.demographics.sex,
    })
    this.lab.verify(order.id, options.actorId)
    this.lab.release(order.id)
    run.labOrder = this.lab.getOrder(order.id)
    run.prescription = {
      id: uuidFromRng(rng),
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      encounterId: run.encounter!.id,
      medicationDisplay: input.medication,
      dose: "per protocol",
      quantity: 1,
      status: "dispensed",
      prescriberId: options.actorId,
      ...markers(run.id),
    }
    this.emit(run, "PrescriptionCreated", "synapse-os", run.prescription.id, "create", {
      medicationDisplay: input.medication,
    })
    this.emit(run, "MedicationDispensed", "synapse-pharm", run.prescription.id, "dispense", {
      medicationDisplay: input.medication,
    })
  }

  private activatePathway(run: SimulationRun, rng: () => number, pathway: ClinicalPathwayDefinition) {
    const plan = instantiateCarePlan({
      id: uuidFromRng(rng),
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      personId: run.patient!.personId,
      encounterId: run.encounter!.id,
      pathway,
      isSynthetic: true,
      simulationRunId: run.id,
      correlationId: run.correlationId,
    })
    this.pathways.start(plan)
    run.carePlan = plan
    this.emit(run, "ClinicalPathwayStarted", "synapse-pathways", plan.id, "start", {
      pathwayId: pathway.id,
      version: pathway.version,
    })
  }

  private runStubScenario(run: SimulationRun, rng: () => number, options: SimulationEngineOptions) {
    this.registerPatient(run, rng, Math.floor(rng() * DEMO_NAMES.length))
    this.startEncounter(run, rng, {
      type: options.scenario === "dka" ? "EMERGENCY" : "OPD",
      chiefComplaint: `${options.scenario} synthetic scenario`,
      vitals: { temp: 37.2, hr: 98, sbp: 110, rr: 22, spo2: 96 },
    })
    run.notes.push(`${options.scenario} generated as a synthetic skeleton; sepsis-critical-lab is the complete vertical slice.`)
  }

  private registerPatient(run: SimulationRun, rng: () => number, index: number) {
    const name = DEMO_NAMES[index % DEMO_NAMES.length]!
    const personId = uuidFromRng(rng)
    const patientId = uuidFromRng(rng)
    const mrn = `DMRN-${String(Math.floor(rng() * 900000) + 100000)}`
    const synapseId = generateSynapseId("UG", entropyFromRng(rng))
    const patient: SimulationPatient = {
      id: patientId,
      personId,
      synapseId,
      mrn,
      demographics: {
        givenName: name.given,
        familyName: name.family,
        fullName: `${name.given} ${name.family}`,
        dateOfBirth: "1984-03-12",
        sex: index % 2 === 0 ? "F" : "M",
        phone: "+256700000001",
      },
      aliases: [
        localMrnIdentifier({ mrn, facilityId: run.tenantId, sourceSystem: "synapse-demo" }),
      ],
      ...markers(run.id),
    }
    run.patient = patient
    this.emit(run, "PatientRegistered", "synapse-os", patient.id, "register", {
      synapseId,
      mrn,
      fullName: patient.demographics.fullName,
    })
    this.pushTimeline(run, "registration", "Demo patient registered", `${synapseId} · ${mrn}`, "patients", patient.id)
  }

  private startEncounter(
    run: SimulationRun,
    rng: () => number,
    input: { type: SimulationEncounter["encounterType"]; chiefComplaint: string; vitals: Record<string, number> },
  ) {
    const encounter: SimulationEncounter = {
      id: uuidFromRng(rng),
      tenantId: run.tenantId,
      patientId: run.patient!.id,
      personId: run.patient!.personId,
      status: "open",
      encounterType: input.type,
      chiefComplaint: input.chiefComplaint,
      vitals: input.vitals,
      ...markers(run.id),
    }
    run.encounter = encounter
    this.emit(run, "EncounterCreated", "synapse-os", encounter.id, "create", {
      encounterType: encounter.encounterType,
      chiefComplaint: encounter.chiefComplaint,
    })
    this.emit(run, "EncounterStarted", "synapse-os", encounter.id, "start", { vitals: encounter.vitals })
    this.pushTimeline(run, "consultation", `${encounter.encounterType} encounter started`, encounter.chiefComplaint, "encounters", encounter.id)
  }

  private emit(
    run: SimulationRun,
    eventType: Parameters<ExchangeOutbox["append"]>[0]["eventType"],
    source: Parameters<ExchangeOutbox["append"]>[0]["source"],
    aggregateId: string,
    action: string,
    payload: Record<string, unknown>,
  ) {
    const last = this.outbox.list({ correlationId: run.correlationId }).at(-1)
    this.outbox.append({
      eventType,
      tenantId: run.tenantId,
      actorId: run.actorId,
      patientId: run.patient?.id ?? null,
      personId: run.patient?.personId ?? null,
      encounterId: run.encounter?.id ?? null,
      correlationId: run.correlationId,
      causationId: last?.event_id ?? null,
      payload: { ...payload, is_synthetic: true, simulation_run_id: run.id },
      source,
      aggregateId,
      action,
      isSynthetic: true,
      simulationRunId: run.id,
    })
  }

  private pushTimeline(
    run: SimulationRun,
    eventType: TimelineEventInput["eventType"],
    title: string,
    summary: string,
    sourceTable: string,
    sourceId: string,
  ) {
    run.timeline.push(timeline(run, eventType, title, summary, sourceTable, sourceId))
  }
}
