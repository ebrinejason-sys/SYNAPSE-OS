/**
 * Platform CRM / commercial relationship management.
 * Extends hospital_leads + commercial_meetings. Platform-only data.
 */

export const CRM_STAGES = [
  'LEAD',
  'CONTACTED',
  'QUALIFIED',
  'DEMO_BOOKED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'ONBOARDING',
  'ACTIVE',
  'LOST',
] as const

export type CrmStage = (typeof CRM_STAGES)[number]

export const MEETING_STATUSES = [
  'requested',
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const

export type MeetingStatus = (typeof MEETING_STATUSES)[number]

const LEGACY_STAGE_MAP: Record<string, CrmStage> = {
  interest: 'LEAD',
  demo: 'DEMO_BOOKED',
  trial: 'ONBOARDING',
  converted: 'ACTIVE',
  lost: 'LOST',
}

export function normalizeCrmStage(value: string | null | undefined): CrmStage | null {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  if ((CRM_STAGES as readonly string[]).includes(upper)) return upper as CrmStage
  const legacy = LEGACY_STAGE_MAP[value.trim().toLowerCase()]
  return legacy ?? null
}

export function isCrmStage(value: string): value is CrmStage {
  return normalizeCrmStage(value) !== null
}

export function isMeetingStatus(value: string): value is MeetingStatus {
  return (MEETING_STATUSES as readonly string[]).includes(value)
}

export function canTransitionStage(from: CrmStage, to: CrmStage): boolean {
  if (from === to) return true
  if (to === 'LOST') return from !== 'ACTIVE'
  if (from === 'LOST') return to === 'LEAD' || to === 'CONTACTED'
  const fromIdx = CRM_STAGES.indexOf(from)
  const toIdx = CRM_STAGES.indexOf(to)
  if (fromIdx < 0 || toIdx < 0) return false
  // Allow forward progress and one-step back for corrections
  return toIdx >= fromIdx - 1
}

export type MeetingRequestInput = {
  name: string
  workEmail: string
  phone?: string | null
  organization?: string | null
  facilityName?: string | null
  facilityType?: string | null
  country?: string | null
  approximateSize?: string | null
  locationsCount?: number | null
  productsInterested?: string[]
  currentSoftware?: string | null
  preferredMeetingAt?: string | null
  message?: string | null
  source?: string | null
}

export type MeetingRequestValidation =
  | { ok: true; value: Required<Pick<MeetingRequestInput, 'name' | 'workEmail'>> & MeetingRequestInput }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanText(value: unknown, max = 500): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/[\u0000-\u001f\u007f]/g, '')
  if (!text) return null
  return text.slice(0, max)
}

function sanitizeEmailHeader(value: string): string {
  // Prevent header injection in outbound mail
  return value.replace(/[\r\n\0]/g, '').trim().slice(0, 254)
}

function parseTimestampOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  // Attempt to parse as a timestamp. If invalid, return null.
  const parsed = new Date(text)
  if (isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function validateMeetingRequest(input: unknown): MeetingRequestValidation {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request body' }
  const body = input as Record<string, unknown>
  const name = cleanText(body.name ?? body.requester_name, 120)
  const workEmail = cleanText(body.workEmail ?? body.work_email ?? body.email, 254)
  if (!name) return { ok: false, error: 'Name is required' }
  if (!workEmail || !EMAIL_RE.test(workEmail)) return { ok: false, error: 'Valid work email is required' }

  const locationsRaw = body.locationsCount ?? body.locations_count
  let locationsCount: number | null = null
  if (locationsRaw !== null && locationsRaw !== undefined && locationsRaw !== '') {
    const n = Number(locationsRaw)
    if (!Number.isFinite(n) || n < 0 || n > 10_000) {
      return { ok: false, error: 'Number of locations must be a reasonable number' }
    }
    locationsCount = Math.floor(n)
  }

  const productsRaw = body.productsInterested ?? body.products_interested ?? body.products
  const productsInterested = Array.isArray(productsRaw)
    ? productsRaw.map((p) => String(p).trim()).filter(Boolean).slice(0, 20)
    : typeof productsRaw === 'string'
      ? productsRaw
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 20)
      : []

  return {
    ok: true,
    value: {
      name,
      workEmail: sanitizeEmailHeader(workEmail.toLowerCase()),
      phone: cleanText(body.phone, 40),
      organization: cleanText(body.organization ?? body.organization_name, 200),
      facilityName: cleanText(body.facilityName ?? body.facility_name, 200),
      facilityType: cleanText(body.facilityType ?? body.facility_type, 60),
      country: cleanText(body.country, 80) ?? 'UG',
      approximateSize: cleanText(body.approximateSize ?? body.approximate_size, 80),
      locationsCount,
      productsInterested,
      currentSoftware: cleanText(body.currentSoftware ?? body.current_software, 200),
      preferredMeetingAt: cleanText(body.preferredMeetingAt ?? body.preferred_meeting_at, 80),
      message: cleanText(body.message ?? body.requirements, 4000),
      source: cleanText(body.source, 80) ?? 'book_meeting',
    },
  }
}

export type LeadConversionDraft = {
  organizationName: string
  facilityName: string
  facilityType: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  country: string | null
  district: string | null
  city: string | null
  requestedProducts: string[]
  leadId: string
}

export function leadToProvisioningDraft(lead: {
  id: string
  organization_name?: string | null
  facility_name?: string | null
  hospital_name?: string | null
  facility_type?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  country?: string | null
  district?: string | null
  city?: string | null
  location?: string | null
  requested_products?: string[] | null
}): LeadConversionDraft {
  const facilityName =
    lead.facility_name?.trim() || lead.hospital_name?.trim() || lead.organization_name?.trim() || 'New facility'
  const organizationName = lead.organization_name?.trim() || facilityName
  return {
    leadId: lead.id,
    organizationName,
    facilityName,
    facilityType: lead.facility_type?.trim() || 'hospital',
    contactName: lead.contact_name ?? null,
    contactEmail: lead.contact_email ?? null,
    contactPhone: lead.contact_phone ?? null,
    country: lead.country ?? 'UG',
    district: lead.district ?? lead.location ?? null,
    city: lead.city ?? null,
    requestedProducts: Array.isArray(lead.requested_products) ? lead.requested_products : [],
  }
}

export function buildMeetingLeadRow(value: MeetingRequestInput & { name: string; workEmail: string }) {
  const facilityName = value.facilityName || value.organization || `${value.name}'s facility`
  const parsedTimestamp = parseTimestampOrNull(value.preferredMeetingAt)
  const notesWithPreference = parsedTimestamp
    ? value.message
    : [value.message, value.preferredMeetingAt ? `Preferred meeting: ${value.preferredMeetingAt}` : null]
        .filter(Boolean)
        .join('\n\n')
  return {
    hospital_name: facilityName,
    organization_name: value.organization || facilityName,
    facility_name: facilityName,
    facility_type: value.facilityType || 'hospital',
    contact_name: value.name,
    contact_email: value.workEmail,
    contact_phone: value.phone,
    country: value.country ?? 'UG',
    location: [value.country].filter(Boolean).join(', ') || null,
    estimated_size: value.approximateSize,
    locations_count: value.locationsCount,
    requested_products: value.productsInterested ?? [],
    current_system: value.currentSoftware,
    notes: notesWithPreference,
    meeting_preferred_at: parsedTimestamp,
    stage: 'LEAD' as const,
    status: 'meeting_requested',
    source: value.source ?? 'book_meeting',
    lead_kind: 'meeting_request',
    onboarding_state: 'none',
  }
}

export function buildMeetingRow(
  value: MeetingRequestInput & { name: string; workEmail: string },
  leadId: string | null,
) {
  const parsedTimestamp = parseTimestampOrNull(value.preferredMeetingAt)
  const messageWithPreference = parsedTimestamp
    ? value.message
    : [value.message, value.preferredMeetingAt ? `Preferred meeting: ${value.preferredMeetingAt}` : null]
        .filter(Boolean)
        .join('\n\n')
  return {
    lead_id: leadId,
    status: 'requested' as const,
    requester_name: value.name,
    requester_email: value.workEmail,
    requester_phone: value.phone,
    organization_name: value.organization,
    facility_name: value.facilityName,
    facility_type: value.facilityType,
    country: value.country ?? 'UG',
    approximate_size: value.approximateSize,
    locations_count: value.locationsCount,
    products_interested: value.productsInterested ?? [],
    current_software: value.currentSoftware,
    preferred_at: parsedTimestamp,
    message: messageWithPreference,
    scheduling_provider: null,
    external_event_id: null,
    metadata: { source: value.source ?? 'book_meeting' },
  }
}
