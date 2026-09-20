import { createHash } from "node:crypto"

/**
 * Reusable Clinical Documents Engine.
 * Signed documents are immutable. Corrections use amendment/addendum versions.
 */

export const CLINICAL_DOCUMENT_TYPES = [
  "REFERRAL_LETTER",
  "DISCHARGE_SUMMARY",
  "TRANSFER_NOTE",
  "CONSENT_FORM",
  "REFUSAL_FORM",
  "MEDICAL_REPORT",
  "SICK_NOTE",
  "PROCEDURE_NOTE",
  "DEATH_PRONOUNCEMENT",
  "DEATH_SUMMARY",
  "LAB_REPORT",
] as const

export type ClinicalDocumentType = (typeof CLINICAL_DOCUMENT_TYPES)[number]

export const CLINICAL_DOCUMENT_STATUSES = [
  "draft",
  "final",
  "signed",
  "amended",
  "superseded",
] as const

export type ClinicalDocumentStatus = (typeof CLINICAL_DOCUMENT_STATUSES)[number]

export type ClinicalDocument = {
  id: string
  tenantId: string
  facilityId: string
  patientId: string
  personId?: string | null
  encounterId?: string | null
  authorId: string
  documentType: ClinicalDocumentType
  templateId: string
  templateVersion: string
  countryPack?: string | null
  structuredPayload: Record<string, unknown>
  renderedSnapshot: string
  contentHash: string
  status: ClinicalDocumentStatus
  signedBy?: string | null
  signedAt?: string | null
  witnessId?: string | null
  witnessName?: string | null
  supersedesId?: string | null
  amendmentOfId?: string | null
  createdAt: string
  audit: Array<{ at: string; actorId: string; action: string; detail?: string }>
}

export function hashDocumentContent(input: {
  documentType: ClinicalDocumentType
  templateVersion: string
  structuredPayload: Record<string, unknown>
  renderedSnapshot: string
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      documentType: input.documentType,
      templateVersion: input.templateVersion,
      structuredPayload: input.structuredPayload,
      renderedSnapshot: input.renderedSnapshot,
    }))
    .digest("hex")
}

export function createClinicalDocument(input: {
  id?: string
  tenantId: string
  facilityId: string
  patientId: string
  personId?: string | null
  encounterId?: string | null
  authorId: string
  documentType: ClinicalDocumentType
  templateId: string
  templateVersion: string
  countryPack?: string | null
  structuredPayload: Record<string, unknown>
  renderedSnapshot: string
}): ClinicalDocument {
  if (!input.tenantId || !input.facilityId) throw new Error("DOCUMENT_TENANT_FACILITY_REQUIRED")
  if (!input.patientId) throw new Error("DOCUMENT_PATIENT_REQUIRED")
  if (!input.authorId) throw new Error("DOCUMENT_AUTHOR_REQUIRED")
  if (!input.renderedSnapshot.trim()) throw new Error("DOCUMENT_SNAPSHOT_REQUIRED")
  const createdAt = new Date().toISOString()
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    facilityId: input.facilityId,
    patientId: input.patientId,
    personId: input.personId ?? null,
    encounterId: input.encounterId ?? null,
    authorId: input.authorId,
    documentType: input.documentType,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    countryPack: input.countryPack ?? null,
    structuredPayload: input.structuredPayload,
    renderedSnapshot: input.renderedSnapshot,
    contentHash: hashDocumentContent(input),
    status: "draft",
    createdAt,
    audit: [{ at: createdAt, actorId: input.authorId, action: "created" }],
  }
}

export function assertDocumentMutable(doc: ClinicalDocument): void {
  if (doc.status === "signed" || doc.status === "superseded") {
    throw new Error("DOCUMENT_IMMUTABLE")
  }
}

export function signClinicalDocument(doc: ClinicalDocument, input: {
  signedBy: string
  witnessId?: string | null
  witnessName?: string | null
  at?: string
}): ClinicalDocument {
  if (doc.status === "signed") throw new Error("DOCUMENT_ALREADY_SIGNED")
  if (doc.status === "superseded") throw new Error("DOCUMENT_IMMUTABLE")
  const signedAt = input.at ?? new Date().toISOString()
  return {
    ...doc,
    status: "signed",
    signedBy: input.signedBy,
    signedAt,
    witnessId: input.witnessId ?? null,
    witnessName: input.witnessName ?? null,
    audit: [...doc.audit, { at: signedAt, actorId: input.signedBy, action: "signed" }],
  }
}

export function amendClinicalDocument(signed: ClinicalDocument, input: {
  authorId: string
  structuredPayload: Record<string, unknown>
  renderedSnapshot: string
  templateVersion?: string
}): ClinicalDocument {
  if (signed.status !== "signed") throw new Error("DOCUMENT_AMEND_REQUIRES_SIGNED")
  const created = createClinicalDocument({
    tenantId: signed.tenantId,
    facilityId: signed.facilityId,
    patientId: signed.patientId,
    personId: signed.personId,
    encounterId: signed.encounterId,
    authorId: input.authorId,
    documentType: signed.documentType,
    templateId: signed.templateId,
    templateVersion: input.templateVersion ?? signed.templateVersion,
    countryPack: signed.countryPack,
    structuredPayload: input.structuredPayload,
    renderedSnapshot: input.renderedSnapshot,
  })
  return {
    ...created,
    amendmentOfId: signed.id,
    supersedesId: signed.id,
    audit: [
      ...created.audit,
      { at: created.createdAt, actorId: input.authorId, action: "amended", detail: signed.id },
    ],
  }
}

export function markSuperseded(signed: ClinicalDocument, actorId: string, successorId: string): ClinicalDocument {
  if (signed.status !== "signed") throw new Error("DOCUMENT_IMMUTABLE")
  return {
    ...signed,
    status: "superseded",
    audit: [...signed.audit, { at: new Date().toISOString(), actorId, action: "superseded", detail: successorId }],
  }
}

export function assertSameTenant(doc: ClinicalDocument, sessionTenantId: string): void {
  if (doc.tenantId !== sessionTenantId) throw new Error("DOCUMENT_TENANT_MISMATCH")
}

export function updateDraftClinicalDocument(
  doc: ClinicalDocument,
  input: { structuredPayload: Record<string, unknown>; renderedSnapshot: string; actorId: string },
): ClinicalDocument {
  assertDocumentMutable(doc)
  const next = {
    ...doc,
    structuredPayload: input.structuredPayload,
    renderedSnapshot: input.renderedSnapshot,
    contentHash: hashDocumentContent({
      documentType: doc.documentType,
      templateVersion: doc.templateVersion,
      structuredPayload: input.structuredPayload,
      renderedSnapshot: input.renderedSnapshot,
    }),
    audit: [...doc.audit, { at: new Date().toISOString(), actorId: input.actorId, action: "updated" }],
  }
  return next
}

export function clinicalDocumentToRow(doc: ClinicalDocument): Record<string, unknown> {
  return {
    id: doc.id,
    tenant_id: doc.tenantId,
    facility_id: doc.facilityId,
    patient_id: doc.patientId,
    person_id: doc.personId ?? null,
    encounter_id: doc.encounterId ?? null,
    author_id: doc.authorId,
    document_type: doc.documentType,
    template_id: doc.templateId,
    template_version: doc.templateVersion,
    country_pack: doc.countryPack ?? null,
    structured_payload: doc.structuredPayload,
    rendered_snapshot: doc.renderedSnapshot,
    content_hash: doc.contentHash,
    status: doc.status,
    signed_by: doc.signedBy ?? null,
    signed_at: doc.signedAt ?? null,
    witness_id: doc.witnessId ?? null,
    witness_name: doc.witnessName ?? null,
    supersedes_id: doc.supersedesId ?? null,
    amendment_of_id: doc.amendmentOfId ?? null,
    created_at: doc.createdAt,
    audit: doc.audit,
  }
}

export function clinicalDocumentFromRow(row: Record<string, unknown>): ClinicalDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    facilityId: String(row.facility_id),
    patientId: String(row.patient_id),
    personId: row.person_id ? String(row.person_id) : null,
    encounterId: row.encounter_id ? String(row.encounter_id) : null,
    authorId: String(row.author_id),
    documentType: row.document_type as ClinicalDocumentType,
    templateId: String(row.template_id),
    templateVersion: String(row.template_version),
    countryPack: row.country_pack ? String(row.country_pack) : null,
    structuredPayload: (row.structured_payload as Record<string, unknown>) ?? {},
    renderedSnapshot: String(row.rendered_snapshot ?? ""),
    contentHash: String(row.content_hash),
    status: row.status as ClinicalDocumentStatus,
    signedBy: row.signed_by ? String(row.signed_by) : null,
    signedAt: row.signed_at ? String(row.signed_at) : null,
    witnessId: row.witness_id ? String(row.witness_id) : null,
    witnessName: row.witness_name ? String(row.witness_name) : null,
    supersedesId: row.supersedes_id ? String(row.supersedes_id) : null,
    amendmentOfId: row.amendment_of_id ? String(row.amendment_of_id) : null,
    createdAt: String(row.created_at),
    audit: Array.isArray(row.audit) ? (row.audit as ClinicalDocument["audit"]) : [],
  }
}
