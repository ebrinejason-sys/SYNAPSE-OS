/**
 * Overlay-mode golden journey: mock EMR → Exchange → Intelligence → ICD-11 →
 * Pathway → Lab → FHIR Observation. Simulation only.
 */

import { ExchangeOutbox } from "./exchange"
import { createSimulationAdapter } from "@synapse/interop"
import {
  buildRecommendation,
  suggestPathway,
  type PatientContextPacket,
} from "@synapse/interop"
import { confirmIcd11Selection, searchIcd11 } from "@synapse/interop"
import { toFhirObservation, toFhirPatient } from "@synapse/interop"
import { LabWorkflow } from "./lab-workflow"
import { PathwayRuntime, getPathway, instantiateCarePlan } from "./pathways"

export type OverlayJourneyResult = {
  remotePatientId: string
  synapsePatientId: string
  pathwayId: string
  icd11: { stemCode: string; title: string; release: string }
  fhirPatientResourceType: string
  fhirObservationResourceType: string
  events: string[]
  simulation: true
}

export async function runOverlayGoldenJourney(params: {
  tenantId: string
  clinicianId: string
  seedPatientId?: string
}): Promise<OverlayJourneyResult> {
  const eafya = createSimulationAdapter("eafya")
  const pulled = await eafya.pullPatients()
  if (!pulled.ok || !pulled.data[0]) throw new Error("OVERLAY_NO_REMOTE_PATIENT")
  const remote = pulled.data[0]

  const outbox = new ExchangeOutbox()
  const correlationId = "overlay-golden"
  outbox.append({
    eventType: "PatientRegistered",
    tenantId: params.tenantId,
    correlationId,
    payload: { remoteId: remote.id, system: "eafya", simulation: true },
    source: "synapse-exchange",
    aggregateId: remote.id,
    action: "import",
    isSynthetic: true,
  })

  const packet: PatientContextPacket = {
    patientId: params.seedPatientId ?? "overlay-local-1",
    tenantId: params.tenantId,
    encounterId: "overlay-enc-1",
    clinicianId: params.clinicianId,
    demographics: { age: 28, sex: "F", display: remote.name.text },
    presentingComplaint: "Fever, chills and headache for 3 days",
    vitals: { temperature_c: 39.1, heart_rate: 118, spo2: 96 },
    laboratory: [],
    guidelineContext: "UCG malaria",
  }

  const recommendation = buildRecommendation({
    id: "rec-overlay-1",
    task: "clinical_copilot",
    packet,
    proposal: {
      conditionName: "Malaria due to Plasmodium falciparum",
      icd11Code: "FAKECODE",
      cantMiss: true,
      confidence: 0.72,
      aiReasoning: "Endemic fever with chills. Model-emitted ICD must be stripped.",
    },
  })
  if (recommendation.icd11Candidates.some((hit) => hit.stemCode === "FAKECODE")) {
    throw new Error("ICD11_INVENTED_CODE_LEAKED")
  }

  const pathwayId = recommendation.suggestedPathwayId ?? suggestPathway(recommendation.proposedTerms)
  if (pathwayId !== "pathway.malaria") throw new Error("OVERLAY_PATHWAY_MISMATCH")
  const pathway = getPathway(pathwayId)
  const runtime = new PathwayRuntime()
  runtime.start(
    instantiateCarePlan({
      id: "cp-overlay-1",
      tenantId: params.tenantId,
      patientId: packet.patientId,
      encounterId: packet.encounterId ?? "overlay-enc-1",
      pathway,
      correlationId,
      isSynthetic: true,
    }),
  )

  const candidate = searchIcd11("Malaria due to Plasmodium falciparum")[0]
  if (!candidate) throw new Error("ICD11_CACHE_MISS")
  const coding = confirmIcd11Selection({
    entity: candidate,
    selectedBy: "clinician",
    suggestedBy: "synapse_intelligence",
  })

  const lab = new LabWorkflow()
  lab.createOrder({
    id: "lab-overlay-1",
    tenantId: params.tenantId,
    patientId: packet.patientId,
    encounterId: packet.encounterId ?? "overlay-enc-1",
    loincCode: "58413-6",
    testName: "Malaria Pf antigen",
    urgency: "URGENT",
    status: "ORDERED",
    orderedBy: params.clinicianId,
    orderedAt: new Date().toISOString(),
    isSynthetic: true,
    correlationId,
  })

  const fhirPatient = toFhirPatient(remote, params.tenantId)
  const fhirObs = toFhirObservation(
    {
      resourceType: "Observation",
      id: "obs-overlay-1",
      personId: remote.id,
      code: "58413-6",
      display: "Malaria Pf antigen",
      value: "Positive",
      provenance: "LAB_VERIFIED",
    },
    params.tenantId,
  )

  outbox.append({
    eventType: "LabResultVerified",
    tenantId: params.tenantId,
    correlationId,
    payload: { observationId: fhirObs.id, simulation: true },
    source: "synapse-lab",
    aggregateId: fhirObs.id,
    action: "verify",
    isSynthetic: true,
  })

  return {
    remotePatientId: remote.id,
    synapsePatientId: packet.patientId,
    pathwayId,
    icd11: { stemCode: coding.stemCode, title: coding.title, release: coding.release },
    fhirPatientResourceType: fhirPatient.resourceType,
    fhirObservationResourceType: fhirObs.resourceType,
    events: outbox.list({ correlationId }).map((row) => row.event_type),
    simulation: true,
  }
}
