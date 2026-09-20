/**
 * Longitudinal patient timeline as a platform primitive.
 * Modules publish events; they do not own isolated timelines.
 */

import type { ProvenanceSource } from "./identity"

export const TIMELINE_EVENT_TYPES = [
  "consultation",
  "laboratory",
  "pharmacy",
  "prescription",
  "insurance",
  "blood_donation",
  "vaccination",
  "admission",
  "discharge",
  "referral",
  "procedure",
  "imaging",
  "document",
  "registration",
  "pathway",
  "critical_result",
  "billing",
] as const

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number]

export type TimelineEventInput = {
  personId?: string | null
  patientId?: string | null
  tenantId: string
  hospitalId?: string | null
  siteId?: string | null
  eventType: TimelineEventType
  title: string
  summary?: string | null
  eventDate?: string
  severity?: string | null
  sourceTable?: string | null
  sourceId?: string | null
  provenance?: ProvenanceSource
  payload?: Record<string, unknown>
  tags?: string[]
  createdBy?: string | null
}

export type TimelineEventRow = TimelineEventInput & {
  id?: string
  createdAt?: string
}

export function assertTimelineSubject(event: TimelineEventInput): void {
  if (!event.personId && !event.patientId) {
    throw new Error("TIMELINE_SUBJECT_REQUIRED")
  }
}

export function pharmacyDispenseTimelineEvent(params: {
  tenantId: string
  personId?: string | null
  patientId?: string | null
  siteId?: string | null
  saleId: string
  receiptNumber?: string | null
  facilityName?: string | null
  itemSummary: string
  createdBy?: string | null
}): TimelineEventInput {
  const title = params.receiptNumber
    ? `Prescription dispensed · ${params.receiptNumber}`
    : "Prescription dispensed"
  return {
    personId: params.personId ?? null,
    patientId: params.patientId ?? null,
    tenantId: params.tenantId,
    siteId: params.siteId ?? null,
    eventType: "pharmacy",
    title,
    summary: [params.facilityName, params.itemSummary].filter(Boolean).join(" — "),
    eventDate: new Date().toISOString(),
    sourceTable: "pharmacy_pos_sales",
    sourceId: params.saleId,
    provenance: "PROVIDER_VERIFIED",
    payload: {
      saleId: params.saleId,
      receiptNumber: params.receiptNumber ?? null,
    },
    tags: ["pharmacy", "dispense"],
    createdBy: params.createdBy ?? null,
  }
}

/**
 * Clinical-return timeline event for a verified (or released) lab result.
 * Used by malaria golden journey / pathway consumers (Agent 2).
 */
export function labResultToTimelineEvent(params: {
  tenantId: string
  personId?: string | null
  patientId?: string | null
  hospitalId?: string | null
  siteId?: string | null
  resultId: string
  orderId?: string | null
  testName: string
  loincCode: string
  resultValue: string
  flag?: string | null
  isAbnormal?: boolean
  isCritical?: boolean
  accessionNumber?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  createdBy?: string | null
}): TimelineEventInput {
  const abnormal = params.isAbnormal || params.isCritical || (params.flag != null && params.flag !== "N")
  const title = abnormal
    ? `${params.testName} · ${params.resultValue} (${params.flag ?? "A"})`
    : `${params.testName} · ${params.resultValue}`
  return {
    personId: params.personId ?? null,
    patientId: params.patientId ?? null,
    tenantId: params.tenantId,
    hospitalId: params.hospitalId ?? null,
    siteId: params.siteId ?? null,
    eventType: params.isCritical ? "critical_result" : "laboratory",
    title,
    summary: [
      params.loincCode,
      params.accessionNumber ? `accession ${params.accessionNumber}` : null,
      params.verifiedBy ? `verified by ${params.verifiedBy}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    eventDate: params.verifiedAt ?? new Date().toISOString(),
    severity: params.isCritical ? "critical" : abnormal ? "abnormal" : null,
    sourceTable: "lab_results",
    sourceId: params.resultId,
    provenance: "LAB_VERIFIED",
    payload: {
      resultId: params.resultId,
      orderId: params.orderId ?? null,
      loincCode: params.loincCode,
      testName: params.testName,
      resultValue: params.resultValue,
      flag: params.flag ?? null,
      isAbnormal: Boolean(params.isAbnormal),
      isCritical: Boolean(params.isCritical),
      accessionNumber: params.accessionNumber ?? null,
    },
    tags: ["laboratory", "lab_result", ...(params.loincCode === "58413-6" ? ["malaria"] : [])],
    createdBy: params.createdBy ?? params.verifiedBy ?? null,
  }
}

export const CANONICAL_TIMELINE_EVENT_TYPES = [
  "encounter",
  "vital",
  "lab_result",
  "imaging",
  "medication",
  "procedure",
  "note",
  "discharge",
  "referral",
  "immunization",
  "allergy",
  "diagnosis",
  "surgery",
  "maternity",
  "telemedicine",
] as const

export type CanonicalTimelineEventType = (typeof CANONICAL_TIMELINE_EVENT_TYPES)[number]

const DOMAIN_TO_CANONICAL_EVENT_TYPE: Record<string, CanonicalTimelineEventType> = {
  consultation: "encounter",
  laboratory: "lab_result",
  critical_result: "lab_result",
  pharmacy: "medication",
  prescription: "medication",
  insurance: "note",
  blood_donation: "procedure",
  vaccination: "immunization",
  admission: "encounter",
  document: "note",
  registration: "encounter",
  pathway: "note",
  billing: "note",
  encounter: "encounter",
  vital: "vital",
  lab_result: "lab_result",
  imaging: "imaging",
  medication: "medication",
  procedure: "procedure",
  note: "note",
  discharge: "discharge",
  referral: "referral",
  immunization: "immunization",
  allergy: "allergy",
  diagnosis: "diagnosis",
  surgery: "surgery",
  maternity: "maternity",
  telemedicine: "telemedicine",
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function toCanonicalTimelineEventType(eventType: string): CanonicalTimelineEventType {
  return DOMAIN_TO_CANONICAL_EVENT_TYPE[eventType] ?? "note"
}

export function toCanonicalTimelineSeverity(severity: string | null | undefined): "info" | "warning" | "critical" | null {
  if (!severity) return null
  if (severity === "info" || severity === "warning" || severity === "critical") return severity
  if (severity === "abnormal") return "warning"
  return null
}

export function toTimelineInsert(event: TimelineEventInput): Record<string, unknown> {
  assertTimelineSubject(event)
  const sourceId = event.sourceId && UUID_RE.test(event.sourceId) ? event.sourceId : null
  return {
    person_id: event.personId ?? null,
    patient_id: event.patientId ?? null,
    tenant_id: event.tenantId,
    hospital_id: event.hospitalId ?? null,
    site_id: event.siteId ?? null,
    event_type: toCanonicalTimelineEventType(event.eventType),
    title: event.title,
    summary: event.summary ?? null,
    event_date: event.eventDate ?? new Date().toISOString(),
    severity: toCanonicalTimelineSeverity(event.severity),
    source_table: event.sourceTable ?? null,
    source_id: sourceId,
    provenance: event.provenance ?? "SYSTEM_GENERATED",
    payload: event.payload ?? {},
    tags: event.tags ?? [],
    created_by: event.createdBy ?? null,
  }
}
