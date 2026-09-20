import { createHash } from "node:crypto"

export const CONSENT_PURPOSES = [
  "facility_access",
  "cross_facility_share",
  "research",
  "emergency_profile",
  "blood_donor_contact",
  "dependant_access",
  "insurance_exchange",
  "care_delivery",
  "general_treatment",
  "procedure",
  "surgery",
  "anesthesia",
  "blood_transfusion",
  "hiv_testing",
  "telemedicine",
  "data_sharing",
  "photography_media",
  "records_release",
  "refusal_of_treatment",
  "discharge_ama",
] as const

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

export const CONSENT_STATUSES = ["granted", "denied", "withdrawn", "expired"] as const
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]

export const CONSENT_SIGNER_RELATIONSHIPS = ["self", "guardian", "proxy"] as const
export type ConsentSignerRelationship = (typeof CONSENT_SIGNER_RELATIONSHIPS)[number]

export const CONSENT_CAPTURE_METHODS = ["electronic_ack", "otp", "paper_scan"] as const
export type ConsentCaptureMethod = (typeof CONSENT_CAPTURE_METHODS)[number]

export const CONSENT_COUNTRY_PACKS = [
  { id: "ug-moh-pack", label: "Uganda MoH pack", jurisdiction: "UG" },
  { id: "ke-moh-pack", label: "Kenya MoH pack", jurisdiction: "KE" },
  { id: "generic-pack", label: "Generic template pack", jurisdiction: "UNSET" },
] as const

export type ConsentCountryPackId = (typeof CONSENT_COUNTRY_PACKS)[number]["id"]

export type ConsentRecord = {
  id?: string
  personId: string
  patientId?: string | null
  purpose: ConsentPurpose
  status: ConsentStatus
  scopeOrganizationId?: string | null
  scopeFacilityId?: string | null
  encounterId?: string | null
  expiresAt?: string | null
  grantedAt?: string | null
  withdrawnAt?: string | null
  signerRelationship?: ConsentSignerRelationship | null
  witnessName?: string | null
  staffWitnessId?: string | null
  captureMethod?: ConsentCaptureMethod | null
  countryPack?: ConsentCountryPackId | string | null
  templateVersion?: string | null
  contentHash?: string | null
  documentId?: string | null
  collectedBy?: string | null
}

export function isConsentActive(consent: ConsentRecord, at = new Date()): boolean {
  if (consent.status !== "granted") return false
  if (consent.expiresAt && new Date(consent.expiresAt) <= at) return false
  return true
}

export function hasPurposeConsent(
  records: ConsentRecord[],
  personId: string,
  purpose: ConsentPurpose,
  facilityId?: string | null,
): boolean {
  return records.some((c) => {
    if (c.personId !== personId || c.purpose !== purpose) return false
    if (!isConsentActive(c)) return false
    if (c.scopeFacilityId && facilityId && c.scopeFacilityId !== facilityId) return false
    return true
  })
}

export type ConsentTemplate = {
  purpose: ConsentPurpose
  label: string
  countryPack: string
  templateVersion: string
  legalTextSource: "country_pack"
}

export const CONSENT_TEMPLATES: ConsentTemplate[] = CONSENT_PURPOSES.flatMap((purpose) =>
  CONSENT_COUNTRY_PACKS.map((pack) => ({
    purpose,
    label: purpose.replaceAll("_", " "),
    countryPack: pack.id,
    templateVersion: "v1",
    legalTextSource: "country_pack" as const,
  })),
)

export function consentTemplateFor(
  purpose: ConsentPurpose,
  countryPack: ConsentCountryPackId | string = "generic-pack",
): ConsentTemplate {
  const match = CONSENT_TEMPLATES.find((row) => row.purpose === purpose && row.countryPack === countryPack)
  if (!match) throw new Error("CONSENT_TEMPLATE_UNKNOWN")
  return match
}

export function hashConsentTemplate(template: ConsentTemplate): string {
  return createHash("sha256")
    .update(JSON.stringify({
      purpose: template.purpose,
      countryPack: template.countryPack,
      templateVersion: template.templateVersion,
      legalTextSource: template.legalTextSource,
    }))
    .digest("hex")
}

export function grantConsent(input: {
  id?: string
  personId: string
  patientId?: string | null
  purpose: ConsentPurpose
  countryPack?: ConsentCountryPackId | string
  signerRelationship: ConsentSignerRelationship
  captureMethod: ConsentCaptureMethod
  collectedBy: string
  scopeFacilityId?: string | null
  encounterId?: string | null
  expiresAt?: string | null
  witnessName?: string | null
  staffWitnessId?: string | null
  documentId?: string | null
}): ConsentRecord {
  if (!input.personId) throw new Error("CONSENT_PERSON_REQUIRED")
  if (!input.collectedBy) throw new Error("CONSENT_COLLECTOR_REQUIRED")
  const template = consentTemplateFor(input.purpose, input.countryPack ?? "generic-pack")
  const grantedAt = new Date().toISOString()
  return {
    id: input.id ?? crypto.randomUUID(),
    personId: input.personId,
    patientId: input.patientId ?? null,
    purpose: input.purpose,
    status: "granted",
    scopeFacilityId: input.scopeFacilityId ?? null,
    encounterId: input.encounterId ?? null,
    expiresAt: input.expiresAt ?? null,
    grantedAt,
    signerRelationship: input.signerRelationship,
    witnessName: input.witnessName ?? null,
    staffWitnessId: input.staffWitnessId ?? null,
    captureMethod: input.captureMethod,
    countryPack: template.countryPack,
    templateVersion: template.templateVersion,
    contentHash: hashConsentTemplate(template),
    documentId: input.documentId ?? null,
    collectedBy: input.collectedBy,
  }
}

export function withdrawConsent(
  record: ConsentRecord,
  input: { actorId: string; at?: string },
): ConsentRecord {
  if (!input.actorId) throw new Error("CONSENT_ACTOR_REQUIRED")
  if (record.status === "withdrawn") throw new Error("CONSENT_ALREADY_WITHDRAWN")
  return {
    ...record,
    status: "withdrawn",
    withdrawnAt: input.at ?? new Date().toISOString(),
  }
}

