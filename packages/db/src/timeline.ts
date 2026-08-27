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

export function toTimelineInsert(event: TimelineEventInput): Record<string, unknown> {
  assertTimelineSubject(event)
  return {
    person_id: event.personId ?? null,
    patient_id: event.patientId ?? null,
    tenant_id: event.tenantId,
    hospital_id: event.hospitalId ?? null,
    site_id: event.siteId ?? null,
    event_type: event.eventType,
    title: event.title,
    summary: event.summary ?? null,
    event_date: event.eventDate ?? new Date().toISOString(),
    severity: event.severity ?? null,
    source_table: event.sourceTable ?? null,
    source_id: event.sourceId ?? null,
    provenance: event.provenance ?? "SYSTEM_GENERATED",
    payload: event.payload ?? {},
    tags: event.tags ?? [],
    created_by: event.createdBy ?? null,
  }
}
