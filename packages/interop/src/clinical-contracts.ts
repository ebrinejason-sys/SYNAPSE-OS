/**
 * Shared clinical contracts. Specialty packs and FHIR adapters consume these.
 * Do not invent a second Encounter / Observation / Medication model.
 *
 * These are TypeScript contracts, not operational UIs. Status is PLANNED or
 * PARTIAL until the capability registry says otherwise.
 */

import type { CanonicalIdentifier, CanonicalPerson } from "./canonical"

export type { CanonicalPerson }

export type ClinicalProvenance =
  | "SELF_REPORTED"
  | "PROVIDER_VERIFIED"
  | "LAB_VERIFIED"
  | "IMPORTED"
  | "SYSTEM_GENERATED"

export type Encounter = {
  resourceType: "Encounter"
  id: string
  personId: string
  facilityId: string
  siteId?: string | null
  status: "planned" | "in_progress" | "finished" | "cancelled"
  classCode: "ambulatory" | "emergency" | "inpatient" | "virtual" | "other"
  periodStart: string
  periodEnd?: string | null
  reason?: string | null
}

export type ClinicalObservation = {
  resourceType: "Observation"
  id: string
  personId: string
  encounterId?: string | null
  code: string
  display: string
  value?: string | number | null
  unit?: string | null
  effectiveAt: string
  provenance: ClinicalProvenance
}

export type Condition = {
  resourceType: "Condition"
  id: string
  personId: string
  encounterId?: string | null
  code: string
  codeSystem: "ICD-11" | "ICD-10" | "SNOMED" | "LOCAL"
  display: string
  clinicalStatus: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved"
  verificationStatus: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted"
  recordedAt: string
}

export type MedicationRequest = {
  resourceType: "MedicationRequest"
  id: string
  personId: string
  encounterId?: string | null
  medicationCode?: string | null
  medicationDisplay: string
  status: "draft" | "active" | "on_hold" | "cancelled" | "completed" | "stopped"
  intent: "order" | "plan" | "original_order"
  authoredAt: string
  requesterId?: string | null
}

export type MedicationDispense = {
  resourceType: "MedicationDispense"
  id: string
  personId?: string | null
  requestId?: string | null
  saleId?: string | null
  facilityId: string
  siteId?: string | null
  status: "preparation" | "in_progress" | "completed" | "cancelled"
  quantity: number
  whenHandedOver?: string | null
}

export type ServiceRequest = {
  resourceType: "ServiceRequest"
  id: string
  personId: string
  encounterId?: string | null
  code: string
  display: string
  category: "laboratory" | "imaging" | "procedure" | "referral" | "other"
  status: "draft" | "active" | "completed" | "revoked"
  authoredAt: string
}

export type DiagnosticResult = {
  resourceType: "DiagnosticReport"
  id: string
  personId?: string | null
  serviceRequestId?: string | null
  specimenId?: string | null
  status: "registered" | "partial" | "final" | "amended" | "cancelled"
  issued?: string | null
  observations: ClinicalObservation[]
}

export type TimelineEvent = {
  personId?: string | null
  patientId?: string | null
  facilityId: string
  siteId?: string | null
  eventType: string
  title: string
  eventDate: string
  provenance?: ClinicalProvenance
  sourceTable?: string | null
  sourceId?: string | null
}

export type IndicatorDefinition = {
  id: string
  code: string
  name: string
  owner: "WHO" | "MOH_UG" | "SDG" | "IDSR" | "LOCAL"
  version: string
  numerator: string
  denominator?: string | null
  disaggregations?: string[]
}

export function requirePersonSubject(resource: { personId?: string | null; patientId?: string | null }): void {
  if (!resource.personId && !resource.patientId) {
    throw new Error("CLINICAL_SUBJECT_REQUIRED")
  }
}

export function identifiersOf(person: CanonicalPerson): CanonicalIdentifier[] {
  return person.identifiers
}
