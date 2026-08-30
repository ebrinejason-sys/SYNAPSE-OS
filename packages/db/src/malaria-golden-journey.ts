/**
 * Malaria Golden Journey — one correlated E2E across Clinical → Intelligence →
 * ICD-11 → Pathway → Lab → Timeline → Prescription → Pharm → FHIR.
 * Step-level PASS/FAIL evidence for the Platform Test Center.
 */

import {
  buildRecommendation,
  confirmIcd11Selection,
  recordClinicianDecision,
  searchIcd11,
  stripInventedIcdCodes,
  toFhirCondition,
  toFhirObservation,
  toFhirPatient,
  type PatientContextPacket,
} from "@synapse/interop"
import { generateSynapseId, localMrnIdentifier } from "./identity"
import { ExchangeOutbox, type RecordDomainEventInput } from "./exchange"
import {
  LabWorkflow,
  barcodeFromAccession,
  formatAccession,
  MALARIA_PF_ANTIGEN_LOINC,
  MALARIA_PF_ANTIGEN_TEST_NAME,
  type LabOrder,
} from "./lab-workflow"
import {
  MALARIA_PATHWAY,
  PathwayRuntime,
  instantiateCarePlan,
  type PatientCarePlan,
} from "./pathways"
export const MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION = "synthetic" as const

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function uuidFromRng(rng: () => number): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(rng() * 256))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type GoldenPatient = {
  id: string
  personId: string
  synapseId: string
  mrn: string
  demographics: {
    givenName: string
    familyName: string
    fullName: string
    dateOfBirth: string
    sex: "M" | "F"
    phone: string
  }
  aliases: ReturnType<typeof localMrnIdentifier>[]
  is_synthetic: true
  data_classification: typeof MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION
  simulation_run_id: string
}

type GoldenEncounter = {
  id: string
  tenantId: string
  patientId: string
  personId: string
  status: "open" | "signed"
  encounterType: "OPD" | "EMERGENCY" | "IPD"
  chiefComplaint: string
  vitals: Record<string, number>
  is_synthetic: true
  data_classification: typeof MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION
  simulation_run_id: string
}

type GoldenPrescription = {
  id: string
  tenantId: string
  patientId: string
  encounterId: string
  medicationDisplay: string
  dose: string
  quantity: number
  status: "active" | "verified" | "dispensed"
  prescriberId: string
  is_synthetic: true
  data_classification: typeof MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION
  simulation_run_id: string
}

type GoldenDispense = {
  id: string
  prescriptionId: string
  tenantId: string
  productName: string
  quantity: number
  batch: string
  remainingStock: number
  is_synthetic: true
  data_classification: typeof MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION
  simulation_run_id: string
}
import {
  pharmacyDispenseTimelineEvent,
  labResultToTimelineEvent,
  toTimelineInsert,
  type TimelineEventInput,
} from "./timeline"

export type GoldenStepStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED" | "NOT_CONFIGURED"

export type GoldenStepEvidence = {
  step: string
  status: GoldenStepStatus
  detail?: string
  startedAt: string
  durationMs: number
  artifacts?: Record<string, unknown>
}

export type MalariaGoldenJourneyResult = {
  correlationId: string
  runId: string
  seed: number
  status: "PASS" | "FAIL"
  steps: GoldenStepEvidence[]
  patient?: { id: string; synapseId: string; name: string }
  error?: string
}

export type MalariaGoldenJourneyParams = {
  tenantId: string
  clinicianId: string
  seed?: number
  outbox?: ExchangeOutbox
  lab?: LabWorkflow
  pathways?: PathwayRuntime
  /** Hydration hooks for SimulationEngine */
  runId?: string
  correlationId?: string
  rng?: () => number
  now?: Date
  /** When true, skip SimulationRunStarted/Completed (caller owns lifecycle). */
  skipRunLifecycleEvents?: boolean
}

export type MalariaGoldenJourneyEntities = {
  patient: GoldenPatient
  encounter: GoldenEncounter
  carePlan: PatientCarePlan
  labOrder: LabOrder
  prescription: GoldenPrescription
  dispense: GoldenDispense
  timeline: TimelineEventInput[]
}

const DEMO_NAMES = [
  { given: "Demo Amina", family: "Nalubega" },
  { given: "Demo Joseph", family: "Okello" },
  { given: "Demo Sarah", family: "Atim" },
  { given: "Demo Peter", family: "Mugisha" },
  { given: "Demo Grace", family: "Namukasa" },
] as const

const CRITICAL_STEPS = [
  "patient_registration",
  "encounter_open",
  "history_vitals",
  "intelligence_recommendation",
  "icd11_lookup",
  "diagnosis_confirmed",
  "pathway_started",
  "lab_ordered",
  "specimen_workflow",
  "lab_result_released",
  "pathway_result_received",
  "prescription_created",
  "pharm_dispense",
  "patient_timeline",
  "fhir_export",
] as const

function entropyFromRng(rng: () => number): Uint8Array {
  return Uint8Array.from({ length: 5 }, () => Math.floor(rng() * 256))
}

function markers(runId: string) {
  return {
    is_synthetic: true as const,
    data_classification: MALARIA_GOLDEN_SYNTHETIC_CLASSIFICATION,
    simulation_run_id: runId,
  }
}

export function evaluateGoldenJourneyStatus(steps: GoldenStepEvidence[]): "PASS" | "FAIL" {
  for (const step of steps) {
    if (step.status === "SKIPPED" || step.status === "NOT_CONFIGURED") continue
    if (step.status !== "PASS") return "FAIL"
  }
  const critical = steps.filter((row) => CRITICAL_STEPS.includes(row.step as (typeof CRITICAL_STEPS)[number]))
  if (critical.length !== CRITICAL_STEPS.length) return "FAIL"
  if (!critical.every((row) => row.status === "PASS")) return "FAIL"
  return "PASS"
}

function computeOverallStatus(steps: GoldenStepEvidence[]): "PASS" | "FAIL" {
  return evaluateGoldenJourneyStatus(steps)
}

function timelineEvent(
  ctx: {
    tenantId: string
    patientId: string
    personId: string
    runId: string
  },
  eventType: TimelineEventInput["eventType"],
  title: string,
  summary: string,
  sourceTable: string,
  sourceId: string,
): TimelineEventInput {
  return {
    personId: ctx.personId,
    patientId: ctx.patientId,
    tenantId: ctx.tenantId,
    eventType,
    title,
    summary,
    eventDate: new Date().toISOString(),
    sourceTable,
    sourceId,
    provenance: "SYSTEM_GENERATED",
    payload: { simulation_run_id: ctx.runId, is_synthetic: true },
    tags: ["synthetic", eventType, "golden-journey"],
  }
}

type JourneyCtx = {
  tenantId: string
  clinicianId: string
  runId: string
  correlationId: string
  seed: number
  rng: () => number
  now: Date
  outbox: ExchangeOutbox
  lab: LabWorkflow
  pathways: PathwayRuntime
  steps: GoldenStepEvidence[]
  timeline: TimelineEventInput[]
  patient?: GoldenPatient
  encounter?: GoldenEncounter
  carePlan?: PatientCarePlan
  labOrder?: LabOrder
  prescription?: GoldenPrescription
  dispense?: GoldenDispense
  icdStem?: string
  recommendationId?: string
}

function appendEvent(ctx: JourneyCtx, input: Omit<RecordDomainEventInput, "correlationId" | "tenantId" | "isSynthetic" | "simulationRunId">) {
  const last = ctx.outbox.list({ correlationId: ctx.correlationId }).at(-1)
  return ctx.outbox.append({
    ...input,
    tenantId: ctx.tenantId,
    actorId: input.actorId ?? ctx.clinicianId,
    patientId: input.patientId ?? ctx.patient?.id ?? null,
    personId: input.personId ?? ctx.patient?.personId ?? null,
    encounterId: input.encounterId ?? ctx.encounter?.id ?? null,
    correlationId: ctx.correlationId,
    causationId: input.causationId ?? last?.event_id ?? null,
    payload: {
      ...input.payload,
      is_synthetic: true,
      simulation_run_id: ctx.runId,
    },
    isSynthetic: true,
    simulationRunId: ctx.runId,
  })
}

function runStep(ctx: JourneyCtx, step: string, fn: () => void): GoldenStepEvidence {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  try {
    const artifacts = fn()
    const evidence: GoldenStepEvidence = {
      step,
      status: "PASS",
      startedAt,
      durationMs: Date.now() - t0,
      artifacts: typeof artifacts === "object" && artifacts !== null ? (artifacts as Record<string, unknown>) : undefined,
    }
    ctx.steps.push(evidence)
    return evidence
  } catch (error) {
    const evidence: GoldenStepEvidence = {
      step,
      status: "FAIL",
      detail: error instanceof Error ? error.message : "step_failed",
      startedAt,
      durationMs: Date.now() - t0,
    }
    ctx.steps.push(evidence)
    return evidence
  }
}

export function executeMalariaGoldenJourney(params: MalariaGoldenJourneyParams): MalariaGoldenJourneyResult & {
  entities?: MalariaGoldenJourneyEntities
} {
  const seed = params.seed ?? 20260829
  const rng = params.rng ?? mulberry32(seed)
  const runId = params.runId ?? uuidFromRng(rng)
  const correlationId = params.correlationId ?? uuidFromRng(rng)
  const now = params.now ?? new Date()

  const ctx: JourneyCtx = {
    tenantId: params.tenantId,
    clinicianId: params.clinicianId,
    runId,
    correlationId,
    seed,
    rng,
    now,
    outbox: params.outbox ?? new ExchangeOutbox(),
    lab: params.lab ?? new LabWorkflow(),
    pathways: params.pathways ?? new PathwayRuntime(),
    steps: [],
    timeline: [],
  }

  if (!params.skipRunLifecycleEvents) {
    appendEvent(ctx, {
      eventType: "SimulationRunStarted",
      source: "synapse-simulation",
      aggregateId: runId,
      action: "start",
      payload: { scenario: "malaria-golden-journey", seed },
    })
  }

  try {
    runStep(ctx, "patient_registration", () => {
      const name = DEMO_NAMES[1]!
      const personId = uuidFromRng(rng)
      const patientId = uuidFromRng(rng)
      const mrn = `DMRN-${String(Math.floor(rng() * 900000) + 100000)}`
      const synapseId = generateSynapseId("UG", entropyFromRng(rng))
      const patient: GoldenPatient = {
        id: patientId,
        personId,
        synapseId,
        mrn,
        demographics: {
          givenName: name.given,
          familyName: name.family,
          fullName: `${name.given} ${name.family}`,
          dateOfBirth: "1988-06-15",
          sex: "F",
          phone: "+256700000001",
        },
        aliases: [localMrnIdentifier({ mrn, facilityId: ctx.tenantId, sourceSystem: "synapse-demo" })],
        ...markers(runId),
      }
      ctx.patient = patient
      appendEvent(ctx, {
        eventType: "PatientRegistered",
        source: "synapse-os",
        aggregateId: patient.id,
        action: "register",
        payload: { synapseId, mrn, fullName: patient.demographics.fullName },
      })
      ctx.timeline.push(
        timelineEvent(
          { tenantId: ctx.tenantId, patientId, personId, runId },
          "registration",
          "Demo patient registered",
          `${synapseId} · ${mrn}`,
          "patients",
          patient.id,
        ),
      )
      return { patientId, synapseId, mrn }
    })

    runStep(ctx, "encounter_open", () => {
      const encounter: GoldenEncounter = {
        id: uuidFromRng(rng),
        tenantId: ctx.tenantId,
        patientId: ctx.patient!.id,
        personId: ctx.patient!.personId,
        status: "open",
        encounterType: "OPD",
        chiefComplaint: "Fever, chills, and headache for 3 days",
        vitals: {},
        ...markers(runId),
      }
      ctx.encounter = encounter
      appendEvent(ctx, {
        eventType: "EncounterCreated",
        source: "synapse-os",
        aggregateId: encounter.id,
        action: "create",
        payload: {
          encounterType: encounter.encounterType,
          chiefComplaint: encounter.chiefComplaint,
        },
      })
      return { encounterId: encounter.id, chiefComplaint: encounter.chiefComplaint }
    })

    runStep(ctx, "history_vitals", () => {
      const history = [
        "3-day history of fever with rigors",
        "Frontal headache, no neck stiffness",
        "No recent travel outside endemic zone",
      ]
      const vitals = { temp: 39.4, hr: 108, sbp: 116, rr: 22, spo2: 97 }
      ctx.encounter!.vitals = vitals
      appendEvent(ctx, {
        eventType: "EncounterStarted",
        source: "synapse-os",
        aggregateId: ctx.encounter!.id,
        action: "start",
        payload: { history, vitals },
      })
      ctx.timeline.push(
        timelineEvent(
          {
            tenantId: ctx.tenantId,
            patientId: ctx.patient!.id,
            personId: ctx.patient!.personId,
            runId,
          },
          "consultation",
          "OPD encounter started",
          ctx.encounter!.chiefComplaint,
          "encounters",
          ctx.encounter!.id,
        ),
      )
      return { history, vitals }
    })

    runStep(ctx, "intelligence_recommendation", () => {
      const packet: PatientContextPacket = {
        patientId: ctx.patient!.id,
        tenantId: ctx.tenantId,
        encounterId: ctx.encounter!.id,
        clinicianId: ctx.clinicianId,
        demographics: { age: 28, sex: "F", display: ctx.patient!.demographics.fullName },
        presentingComplaint: ctx.encounter!.chiefComplaint,
        history: ["Fever with chills", "Headache"],
        vitals: ctx.encounter!.vitals,
        guidelineContext: "UCG malaria",
      }
      const recommendation = buildRecommendation({
        id: uuidFromRng(rng),
        task: "clinical_copilot",
        packet,
        proposal: {
          conditionName: "Malaria due to Plasmodium falciparum",
          icd11Code: "ZZZZ",
          icd11Uri: "https://example.invalid/fake",
          cantMiss: true,
          confidence: 0.78,
          aiReasoning: "Endemic fever pattern; invented ICD must be stripped.",
        },
      })
      ctx.recommendationId = recommendation.id
      const stripped = stripInventedIcdCodes({
        conditionName: recommendation.proposedTerms[0] ?? "Malaria",
        icd11Code: "ZZZZ",
      })
      if (stripped.icd11Code !== null) throw new Error("ICD11_INVENTED_CODE_LEAKED")
      if (recommendation.icd11Candidates.some((hit) => hit.stemCode === "ZZZZ")) {
        throw new Error("ICD11_INVENTED_CODE_LEAKED")
      }
      if (!recommendation.proposedTerms.some((term) => /malaria/i.test(term))) {
        throw new Error("MALARIA_NOT_IN_DIFFERENTIAL")
      }
      appendEvent(ctx, {
        eventType: "EncounterStarted",
        source: "synapse-os",
        aggregateId: ctx.encounter!.id,
        action: "intelligence_recommendation",
        payload: {
          recommendationId: recommendation.id,
          suggestedPathwayId: recommendation.suggestedPathwayId,
          icd11Candidates: recommendation.icd11Candidates.map((hit) => hit.stemCode),
          strippedInventedIcd: true,
        },
      })
      return {
        recommendationId: recommendation.id,
        suggestedPathwayId: recommendation.suggestedPathwayId,
        topCandidate: recommendation.icd11Candidates[0]?.stemCode ?? null,
      }
    })

    runStep(ctx, "icd11_lookup", () => {
      const hits = searchIcd11("malaria falciparum")
      const hit = hits.find((row) => row.stemCode === "1F40") ?? hits[0]
      if (!hit) throw new Error("ICD11_CACHE_MISS")
      appendEvent(ctx, {
        eventType: "EncounterStarted",
        source: "synapse-os",
        aggregateId: ctx.encounter!.id,
        action: "icd11_search",
        payload: {
          query: "malaria falciparum",
          stemCode: hit.stemCode,
          title: hit.title,
          release: hit.release,
        },
      })
      return { stemCode: hit.stemCode, title: hit.title, release: hit.release }
    })

    runStep(ctx, "diagnosis_confirmed", () => {
      const candidate = searchIcd11("Malaria due to Plasmodium falciparum")[0]
      if (!candidate) throw new Error("ICD11_CACHE_MISS")
      const coding = confirmIcd11Selection({
        entity: candidate,
        selectedBy: "clinician",
        suggestedBy: "synapse_intelligence",
      })
      ctx.icdStem = coding.stemCode
      const decision = recordClinicianDecision({
        recommendationId: ctx.recommendationId ?? uuidFromRng(rng),
        decision: "ACCEPT",
        clinicianId: ctx.clinicianId,
      })
      appendEvent(ctx, {
        eventType: "EncounterStarted",
        source: "synapse-os",
        aggregateId: ctx.encounter!.id,
        action: "diagnosis_confirmed",
        payload: {
          stemCode: coding.stemCode,
          title: coding.title,
          release: coding.release,
          selectedBy: coding.selectedBy,
          clinicianDecision: decision.decision,
        },
      })
      return { stemCode: coding.stemCode, title: coding.title, release: coding.release }
    })

    runStep(ctx, "pathway_started", () => {
      const pathway = MALARIA_PATHWAY
      const carePlan = instantiateCarePlan({
        id: uuidFromRng(rng),
        tenantId: ctx.tenantId,
        patientId: ctx.patient!.id,
        personId: ctx.patient!.personId,
        encounterId: ctx.encounter!.id,
        pathway,
        isSynthetic: true,
        simulationRunId: runId,
        correlationId,
      })
      ctx.pathways.start(carePlan)
      ctx.carePlan = carePlan
      appendEvent(ctx, {
        eventType: "ClinicalPathwayStarted",
        source: "synapse-pathways",
        aggregateId: carePlan.id,
        action: "start",
        payload: {
          pathwayId: pathway.id,
          pathwayVersion: pathway.version,
          sourceId: pathway.source.id,
        },
      })
      ctx.pathways.completeStep({
        carePlanId: carePlan.id,
        stepId: "assess",
        actualAction: "Clinician confirmed suspected malaria and started pathway",
      })
      appendEvent(ctx, {
        eventType: "ClinicalPathwayStepCompleted",
        source: "synapse-pathways",
        aggregateId: carePlan.id,
        action: "assess",
        payload: { stepId: "assess", pathwayVersion: pathway.version },
      })
      return { carePlanId: carePlan.id, pathwayId: pathway.id }
    })

    runStep(ctx, "lab_ordered", () => {
      const orderId = uuidFromRng(rng)
      const order: LabOrder = {
        id: orderId,
        tenantId: ctx.tenantId,
        patientId: ctx.patient!.id,
        personId: ctx.patient!.personId,
        encounterId: ctx.encounter!.id,
        carePlanId: ctx.carePlan!.id,
        loincCode: MALARIA_PF_ANTIGEN_LOINC,
        testName: MALARIA_PF_ANTIGEN_TEST_NAME,
        urgency: "URGENT",
        status: "ORDERED",
        orderedBy: ctx.clinicianId,
        orderedAt: now.toISOString(),
        isSynthetic: true,
        simulationRunId: runId,
        correlationId,
      }
      ctx.lab.createOrder(order)
      ctx.lab.transition(order.id, "COLLECTION_PENDING")
      ctx.labOrder = order
      appendEvent(ctx, {
        eventType: "LabOrderCreated",
        source: "synapse-lab",
        aggregateId: order.id,
        action: "create",
        payload: { loincCode: order.loincCode, testName: order.testName, urgency: order.urgency },
      })
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "investigate",
        actualAction: "Malaria Pf antigen ordered",
      })
      ctx.timeline.push(
        timelineEvent(
          {
            tenantId: ctx.tenantId,
            patientId: ctx.patient!.id,
            personId: ctx.patient!.personId,
            runId,
          },
          "laboratory",
          "Malaria Pf antigen ordered",
          "Golden journey investigation step",
          "lab_orders",
          order.id,
        ),
      )
      return { orderId: order.id, loincCode: order.loincCode }
    })

    runStep(ctx, "specimen_workflow", () => {
      const accession = formatAccession("DEMO", Math.floor(rng() * 90000) + 1, now)
      ctx.lab.collect(ctx.labOrder!.id, accession, barcodeFromAccession(accession), uuidFromRng(rng))
      appendEvent(ctx, {
        eventType: "SpecimenCollected",
        source: "synapse-lab",
        aggregateId: ctx.labOrder!.id,
        action: "collect",
        payload: { accession },
      })
      ctx.lab.receive(ctx.labOrder!.id)
      appendEvent(ctx, {
        eventType: "SpecimenReceived",
        source: "synapse-lab",
        aggregateId: ctx.labOrder!.id,
        action: "receive",
        payload: { accession },
      })
      return { accession }
    })

    runStep(ctx, "lab_result_released", () => {
      const accession = ctx.labOrder!.accessionNumber ?? null
      const entered = ctx.lab.enterResult({
        resultId: uuidFromRng(rng),
        orderId: ctx.labOrder!.id,
        value: "Positive",
        analyzer: "DEMO-RDT-1",
        sex: ctx.patient!.demographics.sex,
        ageYears: 28,
      })
      appendEvent(ctx, {
        eventType: "LabResultEntered",
        source: "synapse-lab",
        aggregateId: entered.result.id,
        action: "enter",
        payload: { value: entered.result.resultValue, flag: entered.result.flag, enteredBy: "lab_tech" },
      })
      const verified = ctx.lab.verify(ctx.labOrder!.id, ctx.clinicianId)
      if (verified.verifiedBy !== ctx.clinicianId) throw new Error("LAB_VERIFIER_MUST_BE_CLINICIAN")
      appendEvent(ctx, {
        eventType: "LabResultVerified",
        source: "synapse-lab",
        aggregateId: verified.id,
        action: "verify",
        payload: { value: verified.resultValue, verifiedBy: ctx.clinicianId, aiVerifier: false },
      })
      ctx.lab.release(ctx.labOrder!.id)
      appendEvent(ctx, {
        eventType: "LabResultReleased",
        source: "synapse-lab",
        aggregateId: verified.id,
        action: "release",
        payload: { value: verified.resultValue, accession, releasedAt: verified.releasedAt },
      })
      ctx.labOrder = ctx.lab.getOrder(ctx.labOrder!.id)
      ctx.timeline.push(
        labResultToTimelineEvent({
          tenantId: ctx.tenantId,
          personId: ctx.patient!.personId,
          patientId: ctx.patient!.id,
          resultId: verified.id,
          orderId: ctx.labOrder!.id,
          testName: verified.testName,
          loincCode: verified.loincCode,
          resultValue: verified.resultValue,
          flag: verified.flag,
          isAbnormal: verified.isAbnormal,
          isCritical: verified.isCritical,
          accessionNumber: accession,
          verifiedBy: verified.verifiedBy,
          verifiedAt: verified.verifiedAt,
          createdBy: ctx.clinicianId,
        }),
      )
      return { resultId: verified.id, value: verified.resultValue, status: ctx.labOrder!.status, accession }
    })

    runStep(ctx, "pathway_result_received", () => {
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "interpret",
        actualAction: "Positive malaria antigen reviewed by clinician",
      })
      appendEvent(ctx, {
        eventType: "ClinicalPathwayStepCompleted",
        source: "synapse-pathways",
        aggregateId: ctx.carePlan!.id,
        action: "interpret",
        payload: { stepId: "interpret", labResult: "Positive" },
      })
      return { stepId: "interpret" }
    })

    runStep(ctx, "prescription_created", () => {
      const prescription: GoldenPrescription = {
        id: uuidFromRng(rng),
        tenantId: ctx.tenantId,
        patientId: ctx.patient!.id,
        encounterId: ctx.encounter!.id,
        medicationDisplay: "Artemether/lumefantrine 80/480 mg",
        dose: "4 tablets at 0, 8, 24, 36, 48, 60 hours",
        quantity: 24,
        status: "active",
        prescriberId: ctx.clinicianId,
        ...markers(runId),
      }
      ctx.prescription = prescription
      appendEvent(ctx, {
        eventType: "PrescriptionCreated",
        source: "synapse-os",
        aggregateId: prescription.id,
        action: "create",
        payload: { medicationDisplay: prescription.medicationDisplay, dose: prescription.dose },
      })
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "treat",
        actualAction: "Artemether/lumefantrine prescribed after clinician confirmation",
      })
      ctx.timeline.push(
        timelineEvent(
          {
            tenantId: ctx.tenantId,
            patientId: ctx.patient!.id,
            personId: ctx.patient!.personId,
            runId,
          },
          "prescription",
          "Artemether/lumefantrine prescribed",
          prescription.dose,
          "hospital_drug_orders",
          prescription.id,
        ),
      )
      return { prescriptionId: prescription.id, medication: prescription.medicationDisplay }
    })

    runStep(ctx, "pharm_dispense", () => {
      appendEvent(ctx, {
        eventType: "PrescriptionVerified",
        source: "synapse-pharm",
        aggregateId: ctx.prescription!.id,
        action: "verify",
        payload: { medicationDisplay: ctx.prescription!.medicationDisplay },
      })
      ctx.prescription!.status = "verified"
      const remainingStock = 48
      const dispense: GoldenDispense = {
        id: uuidFromRng(rng),
        prescriptionId: ctx.prescription!.id,
        tenantId: ctx.tenantId,
        productName: ctx.prescription!.medicationDisplay,
        quantity: 24,
        batch: "DEMO-ALU-202608",
        remainingStock: remainingStock - 24,
        ...markers(runId),
      }
      ctx.dispense = dispense
      ctx.prescription!.status = "dispensed"
      appendEvent(ctx, {
        eventType: "MedicationDispensed",
        source: "synapse-pharm",
        aggregateId: dispense.id,
        action: "dispense",
        payload: {
          quantity: dispense.quantity,
          remainingStock: dispense.remainingStock,
          batch: dispense.batch,
        },
      })
      const dispenseTimeline = pharmacyDispenseTimelineEvent({
        tenantId: ctx.tenantId,
        personId: ctx.patient!.personId,
        patientId: ctx.patient!.id,
        saleId: dispense.id,
        receiptNumber: `SYN-DEMO-${dispense.id.slice(0, 8)}`,
        facilityName: "SYNAPSE DEMO HOSPITAL",
        itemSummary: `${dispense.productName} x${dispense.quantity}`,
        createdBy: ctx.clinicianId,
      })
      ctx.timeline.push(dispenseTimeline)
      toTimelineInsert(dispenseTimeline)
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "dispense",
        actualAction: "Pharmacist verified and dispensed ACT",
      })
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "monitor",
        actualAction: "Counselled on ACT adherence",
      })
      ctx.pathways.completeStep({
        carePlanId: ctx.carePlan!.id,
        stepId: "outcome",
        actualAction: "Uncomplicated malaria treated with ACT",
      })
      ctx.pathways.recordOutcome(ctx.carePlan!.id, "act_dispensed")
      ctx.carePlan = ctx.pathways.get(ctx.carePlan!.id)
      appendEvent(ctx, {
        eventType: "ClinicalPathwayCompleted",
        source: "synapse-pathways",
        aggregateId: ctx.carePlan!.id,
        action: "complete",
        payload: { outcome: ctx.carePlan!.outcome, pathwayVersion: MALARIA_PATHWAY.version },
      })
      return { dispenseId: dispense.id, remainingStock: dispense.remainingStock }
    })

    runStep(ctx, "patient_timeline", () => {
      if (ctx.timeline.length < 4) throw new Error("TIMELINE_INSUFFICIENT_EVENTS")
      appendEvent(ctx, {
        eventType: "PatientUpdated",
        source: "synapse-os",
        aggregateId: ctx.patient!.id,
        action: "timeline_recorded",
        payload: {
          eventCount: ctx.timeline.length,
          eventTypes: ctx.timeline.map((row) => row.eventType),
        },
      })
      return { eventCount: ctx.timeline.length, eventTypes: [...new Set(ctx.timeline.map((row) => row.eventType))] }
    })

    runStep(ctx, "fhir_export", () => {
      const person = {
        resourceType: "Person" as const,
        id: ctx.patient!.personId,
        synapseId: ctx.patient!.synapseId,
        identifiers: [{ system: "mrn", value: ctx.patient!.mrn }],
        name: {
          given: [ctx.patient!.demographics.givenName],
          family: ctx.patient!.demographics.familyName,
          text: ctx.patient!.demographics.fullName,
        },
        sex: ctx.patient!.demographics.sex,
        birthDate: ctx.patient!.demographics.dateOfBirth,
      }
      const fhirPatient = toFhirPatient(person, ctx.tenantId)
      const fhirObs = toFhirObservation(
        {
          resourceType: "Observation",
          id: uuidFromRng(rng),
          personId: ctx.patient!.personId,
          code: "58413-6",
          display: "Malaria Pf antigen",
          value: "Positive",
          provenance: "LAB_VERIFIED",
        },
        ctx.tenantId,
      )
      const fhirCondition = toFhirCondition({
        id: uuidFromRng(rng),
        patientId: ctx.patient!.id,
        encounterId: ctx.encounter!.id,
        display: "Malaria due to Plasmodium falciparum",
        stemCode: ctx.icdStem ?? "1F40",
        verificationStatus: "confirmed",
        tenantId: ctx.tenantId,
        release: "2026-01",
      })
      appendEvent(ctx, {
        eventType: "PatientUpdated",
        source: "synapse-exchange",
        aggregateId: ctx.patient!.id,
        action: "fhir_generated",
        payload: {
          resources: [fhirPatient.resourceType, fhirObs.resourceType, fhirCondition.resourceType],
          patientId: fhirPatient.id,
          observationId: fhirObs.id,
          conditionId: fhirCondition.id,
        },
      })
      return {
        patient: fhirPatient.resourceType,
        observation: fhirObs.resourceType,
        condition: fhirCondition.resourceType,
        conditionStem: ctx.icdStem ?? "1F40",
      }
    })

    if (!params.skipRunLifecycleEvents) {
      appendEvent(ctx, {
        eventType: "SimulationRunCompleted",
        source: "synapse-simulation",
        aggregateId: runId,
        action: "complete",
        payload: { scenario: "malaria-golden-journey", status: computeOverallStatus(ctx.steps) },
      })
    }
  } catch (error) {
    if (!params.skipRunLifecycleEvents) {
      appendEvent(ctx, {
        eventType: "SimulationRunCompleted",
        source: "synapse-simulation",
        aggregateId: runId,
        action: "failed",
        payload: { scenario: "malaria-golden-journey", error: error instanceof Error ? error.message : "failed" },
      })
    }
  }

  const status = computeOverallStatus(ctx.steps)
  const result: MalariaGoldenJourneyResult & { entities?: MalariaGoldenJourneyEntities } = {
    correlationId,
    runId,
    seed,
    status,
    steps: ctx.steps,
    patient: ctx.patient
      ? {
          id: ctx.patient.id,
          synapseId: ctx.patient.synapseId,
          name: ctx.patient.demographics.fullName,
        }
      : undefined,
    error: status === "FAIL" ? ctx.steps.find((row) => row.status === "FAIL")?.detail : undefined,
  }

  if (
    ctx.patient &&
    ctx.encounter &&
    ctx.carePlan &&
    ctx.labOrder &&
    ctx.prescription &&
    ctx.dispense
  ) {
    result.entities = {
      patient: ctx.patient,
      encounter: ctx.encounter,
      carePlan: ctx.carePlan,
      labOrder: ctx.labOrder,
      prescription: ctx.prescription,
      dispense: ctx.dispense,
      timeline: ctx.timeline,
    }
  }

  return result
}

export async function runMalariaGoldenJourney(
  params: MalariaGoldenJourneyParams,
): Promise<MalariaGoldenJourneyResult & { entities?: MalariaGoldenJourneyEntities }> {
  return executeMalariaGoldenJourney(params)
}

export function assertMalariaGoldenJourneyPass(result: MalariaGoldenJourneyResult): void {
  if (result.status !== "PASS") {
    throw new Error(result.error ?? "MALARIA_GOLDEN_JOURNEY_FAILED")
  }
}
