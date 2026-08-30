/**
 * Versioned SYNAPSE Exchange domain events.
 * Modules communicate through these contracts rather than ad-hoc table writes.
 */

export const DOMAIN_EVENT_TYPES = [
  "PatientRegistered",
  "PatientUpdated",
  "PatientMerged",
  "EncounterCreated",
  "EncounterStarted",
  "PatientAdmitted",
  "EncounterSigned",
  "EncounterSigned",
  "EncounterCompleted",
  "ClinicalPathwayStarted",
  "ClinicalPathwayStepCompleted",
  "ClinicalPathwayOverridden",
  "ClinicalPathwayCompleted",
  "LabOrderCreated",
  "SpecimenCollected",
  "SpecimenReceived",
  "SpecimenRejected",
  "LabResultEntered",
  "LabResultVerified",
  "LabResultReleased",
  "LabResultAmended",
  "CriticalLabResultDetected",
  "CriticalLabResultAcknowledged",
  "PrescriptionCreated",
  "PrescriptionVerified",
  "MedicationDispensed",
  "MedicationReturned",
  "ImagingOrderCreated",
  "ImagingReportFinalized",
  "InvoiceCreated",
  "PaymentRecorded",
  "ClaimSubmitted",
  "ClaimRejected",
  "ClaimPaid",
  "ReferralCreated",
  "ReferralAccepted",
  "ReferralCompleted",
  "SimulationRunStarted",
  "SimulationRunCompleted",
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

export const EVENT_SOURCES = [
  "synapse-os",
  "synapse-lab",
  "synapse-pharm",
  "synapse-app",
  "synapse-pathways",
  "synapse-exchange",
  "synapse-simulation",
  "synapse-admin",
] as const

export type EventSource = (typeof EVENT_SOURCES)[number]

export type DomainEventEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = {
  event_id: string
  event_type: DomainEventType
  version: string
  tenant_id: string
  facility_id?: string | null
  actor_id?: string | null
  patient_id?: string | null
  person_id?: string | null
  encounter_id?: string | null
  timestamp: string
  correlation_id: string
  causation_id?: string | null
  payload: T
  source: EventSource
  idempotency_key: string
  is_synthetic?: boolean
  simulation_run_id?: string | null
}

export type OutboxStatus = "pending" | "published" | "failed" | "dead"

export type OutboxRecord<T extends Record<string, unknown> = Record<string, unknown>> = DomainEventEnvelope<T> & {
  status: OutboxStatus
  retry_count: number
  last_error?: string | null
  published_at?: string | null
}

export const EVENT_TYPE_VERSION: Record<DomainEventType, string> = {
  PatientRegistered: "1.0.0",
  PatientUpdated: "1.0.0",
  PatientMerged: "1.0.0",
  EncounterCreated: "1.0.0",
  EncounterStarted: "1.0.0",
  PatientAdmitted: "1.0.0",
  EncounterSigned: "1.0.0",
  EncounterSigned: "1.0.0",
  EncounterCompleted: "1.0.0",
  ClinicalPathwayStarted: "1.0.0",
  ClinicalPathwayStepCompleted: "1.0.0",
  ClinicalPathwayOverridden: "1.0.0",
  ClinicalPathwayCompleted: "1.0.0",
  LabOrderCreated: "1.0.0",
  SpecimenCollected: "1.0.0",
  SpecimenReceived: "1.0.0",
  SpecimenRejected: "1.0.0",
  LabResultEntered: "1.0.0",
  LabResultVerified: "1.0.0",
  LabResultReleased: "1.0.0",
  LabResultAmended: "1.0.0",
  CriticalLabResultDetected: "1.0.0",
  CriticalLabResultAcknowledged: "1.0.0",
  PrescriptionCreated: "1.0.0",
  PrescriptionVerified: "1.0.0",
  MedicationDispensed: "1.0.0",
  MedicationReturned: "1.0.0",
  ImagingOrderCreated: "1.0.0",
  ImagingReportFinalized: "1.0.0",
  InvoiceCreated: "1.0.0",
  PaymentRecorded: "1.0.0",
  ClaimSubmitted: "1.0.0",
  ClaimRejected: "1.0.0",
  ClaimPaid: "1.0.0",
  ReferralCreated: "1.0.0",
  ReferralAccepted: "1.0.0",
  ReferralCompleted: "1.0.0",
  SimulationRunStarted: "1.0.0",
  SimulationRunCompleted: "1.0.0",
}

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(value)
}

export function eventIdempotencyKey(input: {
  eventType: DomainEventType
  tenantId: string
  aggregateId: string
  action: string
}): string {
  return `${input.eventType}:${input.tenantId}:${input.aggregateId}:${input.action}`
}

export function maskPatientId(id: string | null | undefined): string | null {
  if (!id) return null
  if (id.length <= 8) return "••••"
  return `${id.slice(0, 4)}…${id.slice(-4)}`
}

export type EventChainNode = {
  event_id: string
  event_type: DomainEventType
  timestamp: string
  source: EventSource
  causation_id?: string | null
}

export function sortEventChain(events: EventChainNode[]): EventChainNode[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
