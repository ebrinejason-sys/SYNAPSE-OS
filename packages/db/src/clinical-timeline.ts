/**
 * Timeline publishers for hospital clinical handoffs (P1-007).
 */

import type { TimelineEventInput } from "./timeline.ts"

export function encounterOpenedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  chiefComplaint: string
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "consultation",
    title: "OPD encounter opened",
    summary: params.chiefComplaint,
    sourceTable: "encounters",
    sourceId: params.encounterId,
    provenance: "PROVIDER_VERIFIED",
    payload: { encounterId: params.encounterId, chiefComplaint: params.chiefComplaint },
    tags: ["opd", "encounter"],
    createdBy: params.createdBy ?? null,
  }
}

export function labOrderTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  orderId: string
  encounterId: string
  testName: string
  loincCode: string
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "laboratory",
    title: `Lab ordered · ${params.testName}`,
    summary: params.loincCode,
    sourceTable: "lab_orders",
    sourceId: params.orderId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      orderId: params.orderId,
      encounterId: params.encounterId,
      loincCode: params.loincCode,
    },
    tags: ["laboratory", "lab_order", ...(params.loincCode === "58413-6" ? ["malaria"] : [])],
    createdBy: params.createdBy ?? null,
  }
}

export function prescriptionTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  prescriptionId: string
  encounterId: string
  medicationDisplay: string
  dose: string
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "prescription",
    title: `Prescription · ${params.medicationDisplay}`,
    summary: params.dose,
    sourceTable: "clinical_prescriptions",
    sourceId: params.prescriptionId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      prescriptionId: params.prescriptionId,
      encounterId: params.encounterId,
    },
    tags: ["prescription"],
    createdBy: params.createdBy ?? null,
  }
}

export function admissionTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  admissionId: string
  bedId: string
  ward?: string | null
  reason: string
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "admission",
    title: "Patient admitted",
    summary: [params.ward, params.reason].filter(Boolean).join(" · "),
    sourceTable: "hospital_beds",
    sourceId: params.bedId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      admissionId: params.admissionId,
      bedId: params.bedId,
      ward: params.ward ?? null,
    },
    tags: ["admission", "ipd"],
    createdBy: params.createdBy ?? null,
  }
}

export function encounterSignedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  signedBy: string
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "document",
    title: "Encounter note signed",
    summary: "Clinical note locked for amendment trail",
    sourceTable: "encounters",
    sourceId: params.encounterId,
    provenance: "PROVIDER_VERIFIED",
    payload: { encounterId: params.encounterId, signedBy: params.signedBy },
    tags: ["encounter", "signed"],
    createdBy: params.signedBy,
  }
}

export async function publishClinicalTimelineBestEffort(
  publish: (event: TimelineEventInput) => Promise<string | null>,
  event: TimelineEventInput,
): Promise<string | null> {
  try {
    return await publish(event)
  } catch (error) {
    console.warn("[clinical-timeline] publish failed", error)
    return null
  }
}
