/**
 * SYNAPSE canonical clinical model. External FHIR/HL7/OpenMRS resources are
 * translated into this shape. The core app never depends on raw vendor payloads.
 */

export type CanonicalResourceType =
  | "Person"
  | "Encounter"
  | "Practitioner"
  | "Organization"
  | "Location"
  | "Observation"
  | "DiagnosticReport"
  | "Medication"
  | "MedicationRequest"
  | "MedicationDispense"
  | "ServiceRequest"
  | "Specimen"
  | "Coverage"
  | "Claim"
  | "AllergyIntolerance"
  | "Condition"

export type CanonicalIdentifier = {
  system: string
  value: string
  type?: string
  assigner?: string
}

export type CanonicalPerson = {
  resourceType: "Person"
  id: string
  synapseId?: string
  identifiers: CanonicalIdentifier[]
  name: { family?: string; given: string[]; text: string }
  birthDate?: string
  sex?: "M" | "F" | "I" | "U"
}

export type CanonicalSpecimen = {
  resourceType: "Specimen"
  id: string
  accession: string
  barcode?: string
  personId?: string
  orderId?: string
  encounterId?: string
  type?: string
}

export type CanonicalObservation = {
  resourceType: "Observation"
  id: string
  specimenId?: string
  personId?: string
  code: string
  display: string
  value?: string | number
  unit?: string
  interpretation?: "N" | "H" | "L" | "HH" | "LL" | "A" | "AA"
  referenceRange?: string
  provenance: "SELF_REPORTED" | "PROVIDER_VERIFIED" | "LAB_VERIFIED" | "IMPORTED" | "SYSTEM_GENERATED"
}

export type CanonicalBundle = {
  resources: Array<{ resourceType: CanonicalResourceType; id: string; [key: string]: unknown }>
}

export const FHIR_RESOURCE_MAP: Record<string, CanonicalResourceType> = {
  Patient: "Person",
  Person: "Person",
  Encounter: "Encounter",
  Practitioner: "Practitioner",
  Organization: "Organization",
  Location: "Location",
  Observation: "Observation",
  DiagnosticReport: "DiagnosticReport",
  Medication: "Medication",
  MedicationRequest: "MedicationRequest",
  MedicationDispense: "MedicationDispense",
  ServiceRequest: "ServiceRequest",
  Specimen: "Specimen",
  Coverage: "Coverage",
  Claim: "Claim",
  AllergyIntolerance: "AllergyIntolerance",
  Condition: "Condition",
}

export function fhirResourceToCanonicalType(fhirType: string): CanonicalResourceType | null {
  return FHIR_RESOURCE_MAP[fhirType] ?? null
}
