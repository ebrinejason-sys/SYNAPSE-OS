export const CONSENT_PURPOSES = [
  "facility_access",
  "cross_facility_share",
  "research",
  "emergency_profile",
  "blood_donor_contact",
  "dependant_access",
  "insurance_exchange",
  "care_delivery",
] as const

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

export const CONSENT_STATUSES = ["granted", "denied", "withdrawn", "expired"] as const
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]

export type ConsentRecord = {
  personId: string
  purpose: ConsentPurpose
  status: ConsentStatus
  scopeOrganizationId?: string | null
  scopeFacilityId?: string | null
  expiresAt?: string | null
  grantedAt?: string | null
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
