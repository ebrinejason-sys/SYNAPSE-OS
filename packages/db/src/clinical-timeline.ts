/**
 * Timeline publishers for hospital clinical handoffs (P1-007).
 */

import type { TimelineEventInput } from "./timeline"

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

export function encounterAmendedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  amendmentId: string
  fieldName: string
  reason: string
  amendedBy: string
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "document",
    title: `Encounter amended · ${params.fieldName.replace(/_/g, " ")}`,
    summary: params.reason,
    sourceTable: "encounter_amendments",
    sourceId: params.amendmentId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      encounterId: params.encounterId,
      amendmentId: params.amendmentId,
      fieldName: params.fieldName,
    },
    tags: ["encounter", "amendment"],
    createdBy: params.amendedBy,
  }
}

export function labResultReleasedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  orderId: string
  encounterId: string
  testName: string
  resultValue: string
  releasedBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "laboratory",
    title: `Lab result released · ${params.testName}`,
    summary: params.resultValue,
    sourceTable: "lab_orders",
    sourceId: params.orderId,
    provenance: "LAB_VERIFIED",
    payload: {
      orderId: params.orderId,
      encounterId: params.encounterId,
      resultValue: params.resultValue,
    },
    tags: ["laboratory", "lab_result", "released"],
    createdBy: params.releasedBy ?? null,
  }
}

export function medicationDispensedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  prescriptionId: string
  encounterId: string
  medicationDisplay: string
  quantity: number
  saleId?: string | null
  dispensedBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "prescription",
    title: `Medication dispensed · ${params.medicationDisplay}`,
    summary: `Qty ${params.quantity}${params.saleId ? ` · sale ${params.saleId}` : ""}`,
    sourceTable: "clinical_prescriptions",
    sourceId: params.prescriptionId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      prescriptionId: params.prescriptionId,
      encounterId: params.encounterId,
      saleId: params.saleId ?? null,
    },
    tags: ["prescription", "dispensed"],
    createdBy: params.dispensedBy ?? null,
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

export function edTriageTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  chiefComplaint: string
  clinicalStage: string
  arrivalMode?: string | null
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "consultation",
    title: `ED triage · ${params.clinicalStage}`,
    summary: params.chiefComplaint,
    sourceTable: "encounters",
    sourceId: params.encounterId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      encounterId: params.encounterId,
      clinicalStage: params.clinicalStage,
      arrivalMode: params.arrivalMode ?? "walk_in",
      department: "emergency",
    },
    tags: ["emergency", "triage", params.clinicalStage.toLowerCase()],
    severity: params.clinicalStage === "RED" ? "critical" : null,
    createdBy: params.createdBy ?? null,
  }
}

export function edBayAssignedTimelineEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  bayId: string
  bayName: string
  locationType?: string | null
  createdBy?: string | null
}): TimelineEventInput {
  return {
    tenantId: params.tenantId,
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    eventType: "admission",
    title: `ED bay assigned · ${params.bayName}`,
    summary: params.locationType ?? "bay",
    sourceTable: "facility_locations",
    sourceId: params.bayId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      encounterId: params.encounterId,
      bayId: params.bayId,
      bayName: params.bayName,
      department: "emergency",
    },
    tags: ["emergency", "bay"],
    createdBy: params.createdBy ?? null,
  }
}
