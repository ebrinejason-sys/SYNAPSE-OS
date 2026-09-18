/**
 * FHIR R4 mappers for the flagship SYNAPSE journey.
 * CapabilityStatement must be generated from this list — never from marketing.
 */

import type { CanonicalObservation, CanonicalPerson, CanonicalSpecimen } from "../canonical"

export const FHIR_VERSION = "4.0.1"

/** Lab-backed resources with proven tenant-scoped read/search. */
export const PROVEN_FHIR_RESOURCES = ["Observation", "Specimen", "DiagnosticReport"] as const

export type ProvenFhirResource = (typeof PROVEN_FHIR_RESOURCES)[number]

/** Mappers exist; HTTP is 501 OperationOutcome until roundtrip is proven. */
export const FLAGSHIP_FHIR_RESOURCES = [
  "Patient",
  "Practitioner",
  "Organization",
  "Encounter",
  "Condition",
  "ServiceRequest",
  "Specimen",
  "Observation",
  "DiagnosticReport",
  "MedicationRequest",
  "MedicationDispense",
] as const

export type FlagshipFhirResource = (typeof FLAGSHIP_FHIR_RESOURCES)[number]

export const UNIMPLEMENTED_FHIR_RESOURCES = ["Immunization", "AllergyIntolerance"] as const

export type FhirResource = {
  resourceType: string
  id: string
  meta?: { profile?: string[]; lastUpdated?: string }
  [key: string]: unknown
}

export type FhirBundle = {
  resourceType: "Bundle"
  type: "searchset"
  total: number
  entry: Array<{ resource: FhirResource }>
}

export type FhirCapabilityStatement = {
  resourceType: "CapabilityStatement"
  status: "draft" | "active" | "retired"
  date: string
  publisher: string
  kind: "instance"
  fhirVersion: string
  format: string[]
  software: { name: string; version: string }
  rest: Array<{
    mode: "server"
    security?: { cors?: boolean; description?: string }
    resource: Array<{ type: string; interaction: Array<{ code: string }> }>
  }>
}

function meta(): FhirResource["meta"] {
  return { lastUpdated: new Date().toISOString() }
}

export function toFhirPatient(person: CanonicalPerson, tenantId: string): FhirResource {
  return {
    resourceType: "Patient",
    id: person.id,
    meta: meta(),
    identifier: [
      ...(person.synapseId ? [{ system: "https://synapseos.tech/sid", value: person.synapseId }] : []),
      ...person.identifiers.map((item) => ({ system: item.system, value: item.value })),
    ],
    name: [{ family: person.name.family, given: person.name.given, text: person.name.text }],
    gender: person.sex === "F" ? "female" : person.sex === "M" ? "male" : "unknown",
    birthDate: person.birthDate,
    metaTenant: tenantId,
  }
}

export function toFhirPractitioner(params: { id: string; display: string; tenantId: string }): FhirResource {
  return {
    resourceType: "Practitioner",
    id: params.id,
    meta: meta(),
    name: [{ text: params.display }],
    metaTenant: params.tenantId,
  }
}

export function toFhirOrganization(params: { id: string; name: string; tenantId: string }): FhirResource {
  return {
    resourceType: "Organization",
    id: params.id,
    meta: meta(),
    name: params.name,
    metaTenant: params.tenantId,
  }
}

export function toFhirEncounter(params: {
  id: string
  patientId: string
  status: "in-progress" | "finished" | "planned"
  classCode: string
  tenantId: string
}): FhirResource {
  return {
    resourceType: "Encounter",
    id: params.id,
    meta: meta(),
    status: params.status,
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: params.classCode },
    subject: { reference: `Patient/${params.patientId}` },
    metaTenant: params.tenantId,
  }
}

export function toFhirCondition(params: {
  id: string
  patientId: string
  encounterId?: string
  display: string
  stemCode?: string | null
  linearizationUri?: string | null
  release?: string | null
  verificationStatus: "provisional" | "confirmed"
  tenantId: string
}): FhirResource {
  return {
    resourceType: "Condition",
    id: params.id,
    meta: meta(),
    subject: { reference: `Patient/${params.patientId}` },
    encounter: params.encounterId ? { reference: `Encounter/${params.encounterId}` } : undefined,
    code: {
      coding: params.stemCode
        ? [
            {
              system: "http://id.who.int/icd/release/11/mms",
              code: params.stemCode,
              display: params.display,
              version: params.release ?? "2026-01",
            },
          ]
        : [],
      text: params.display,
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: params.verificationStatus,
        },
      ],
    },
    metaTenant: params.tenantId,
  }
}

export function toFhirServiceRequest(params: {
  id: string
  patientId: string
  encounterId?: string
  code: string
  display: string
  intent?: string
  tenantId: string
}): FhirResource {
  return {
    resourceType: "ServiceRequest",
    id: params.id,
    meta: meta(),
    status: "active",
    intent: params.intent ?? "order",
    code: { coding: [{ system: "http://loinc.org", code: params.code, display: params.display }], text: params.display },
    subject: { reference: `Patient/${params.patientId}` },
    encounter: params.encounterId ? { reference: `Encounter/${params.encounterId}` } : undefined,
    metaTenant: params.tenantId,
  }
}

export function toFhirSpecimen(specimen: CanonicalSpecimen, tenantId: string): FhirResource {
  return {
    resourceType: "Specimen",
    id: specimen.id,
    meta: meta(),
    accessionIdentifier: { value: specimen.accession },
    subject: specimen.personId ? { reference: `Patient/${specimen.personId}` } : undefined,
    type: specimen.type ? { text: specimen.type } : undefined,
    metaTenant: tenantId,
  }
}

export function toFhirObservation(obs: CanonicalObservation, tenantId: string): FhirResource {
  return {
    resourceType: "Observation",
    id: obs.id,
    meta: meta(),
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: obs.code, display: obs.display }], text: obs.display },
    subject: obs.personId ? { reference: `Patient/${obs.personId}` } : undefined,
    valueString: obs.value != null ? String(obs.value) : undefined,
    interpretation: obs.interpretation ? [{ coding: [{ code: obs.interpretation }] }] : undefined,
    referenceRange: obs.referenceRange ? [{ text: obs.referenceRange }] : undefined,
    specimen: obs.specimenId ? { reference: `Specimen/${obs.specimenId}` } : undefined,
    metaTenant: tenantId,
  }
}

export function toFhirDiagnosticReport(params: {
  id: string
  patientId: string
  observationIds: string[]
  code: string
  display: string
  tenantId: string
}): FhirResource {
  return {
    resourceType: "DiagnosticReport",
    id: params.id,
    meta: meta(),
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: params.code, display: params.display }], text: params.display },
    subject: { reference: `Patient/${params.patientId}` },
    result: params.observationIds.map((id) => ({ reference: `Observation/${id}` })),
    metaTenant: params.tenantId,
  }
}

export function toFhirMedicationRequest(params: {
  id: string
  patientId: string
  encounterId?: string
  medicationDisplay: string
  status?: string
  tenantId: string
}): FhirResource {
  return {
    resourceType: "MedicationRequest",
    id: params.id,
    meta: meta(),
    status: params.status ?? "active",
    intent: "order",
    medicationCodeableConcept: { text: params.medicationDisplay },
    subject: { reference: `Patient/${params.patientId}` },
    encounter: params.encounterId ? { reference: `Encounter/${params.encounterId}` } : undefined,
    metaTenant: params.tenantId,
  }
}

export function toFhirMedicationDispense(params: {
  id: string
  patientId: string
  medicationRequestId?: string
  medicationDisplay: string
  quantity: number
  tenantId: string
}): FhirResource {
  return {
    resourceType: "MedicationDispense",
    id: params.id,
    meta: meta(),
    status: "completed",
    medicationCodeableConcept: { text: params.medicationDisplay },
    subject: { reference: `Patient/${params.patientId}` },
    authorizingPrescription: params.medicationRequestId
      ? [{ reference: `MedicationRequest/${params.medicationRequestId}` }]
      : undefined,
    quantity: { value: params.quantity },
    metaTenant: params.tenantId,
  }
}

export function searchBundle(resources: FhirResource[]): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  }
}

export function validateFhirResource(resource: FhirResource): string[] {
  const errors: string[] = []
  if (!resource.resourceType) errors.push("resourceType required")
  if (!resource.id) errors.push("id required")
  if (!(FLAGSHIP_FHIR_RESOURCES as readonly string[]).includes(resource.resourceType)) {
    errors.push(`resourceType ${resource.resourceType} is not a flagship SYNAPSE FHIR resource`)
  }
  return errors
}

export function buildCapabilityStatement(now = new Date()): FhirCapabilityStatement {
  return {
    resourceType: "CapabilityStatement",
    status: "draft",
    date: now.toISOString(),
    publisher: "Synapse Health Technologies Ltd",
    kind: "instance",
    fhirVersion: FHIR_VERSION,
    format: ["json"],
    software: { name: "Synapse OS", version: "golden-0" },
    rest: [
      {
        mode: "server",
        security: {
          cors: false,
          description: "Tenant session required. Service-role is not exposed to clients.",
        },
        resource: PROVEN_FHIR_RESOURCES.map((type) => ({
          type,
          interaction: [{ code: "read" }, { code: "search-type" }],
        })),
      },
    ],
  }
}

export function isFlagshipFhirResource(type: string): type is FlagshipFhirResource {
  return (FLAGSHIP_FHIR_RESOURCES as readonly string[]).includes(type)
}

export function isProvenFhirResource(type: string): type is ProvenFhirResource {
  return (PROVEN_FHIR_RESOURCES as readonly string[]).includes(type)
}

export function classifyFhirHttpType(resource: string): "proven" | "flagship_unproven" | "unimplemented" | "unknown" {
  if ((UNIMPLEMENTED_FHIR_RESOURCES as readonly string[]).includes(resource)) return "unimplemented"
  if (isProvenFhirResource(resource)) return "proven"
  if (isFlagshipFhirResource(resource)) return "flagship_unproven"
  return "unknown"
}
