/**
 * Death / pronouncement domain.
 * Pronouncement is a clinical determination. Certification is a separate legal act.
 * Time of death may be EXACT, ESTIMATED, or UNKNOWN — never fabricate a clock time.
 * AI cannot pronounce, certify, or release a body.
 */

export const DEATH_TIME_PRECISIONS = ["EXACT", "ESTIMATED", "UNKNOWN"] as const
export type DeathTimePrecision = (typeof DEATH_TIME_PRECISIONS)[number]

export const DEATH_LOCATION_TYPES = [
  "ward",
  "emergency",
  "theatre",
  "icu",
  "arrival",
  "community",
  "other",
] as const
export type DeathLocationType = (typeof DEATH_LOCATION_TYPES)[number]

export const DEATH_RECORD_STATUSES = [
  "draft",
  "pronounced",
  "certified",
  "amended",
] as const
export type DeathRecordStatus = (typeof DEATH_RECORD_STATUSES)[number]

export const MEDICOLEGAL_FLAGS = [
  "trauma",
  "poisoning",
  "suspected_homicide",
  "suspected_suicide",
  "unknown_cause",
  "death_on_arrival",
  "maternal_death",
  "neonatal_death",
  "perioperative_death",
] as const
export type MedicolegalFlag = (typeof MEDICOLEGAL_FLAGS)[number]

export const ENCOUNTER_OUTCOME_DISPOSITIONS = [
  "DISCHARGED",
  "ADMITTED",
  "TRANSFERRED",
  "REFERRED",
  "DECEASED",
  "AMA",
  "LEFT_BEFORE_COMPLETION",
] as const
export type EncounterOutcomeDisposition = (typeof ENCOUNTER_OUTCOME_DISPOSITIONS)[number]

/** Capability keys — never hardcode universal authority in routes. */
export const DEATH_CAPABILITIES = {
  pronounce: { module: "clinical", resource: "death", action: "pronounce" },
  certify: { module: "clinical", resource: "death", action: "certify" },
  summary: { module: "clinical", resource: "death", action: "summary" },
  view: { module: "clinical", resource: "death", action: "view" },
  recordsView: { module: "registration", resource: "death", action: "view" },
} as const

export const AI_FORBIDDEN_DEATH_ACTIONS = [
  "pronounce_death",
  "certify_death",
  "release_body",
] as const

export type PronouncementFindings = {
  noPulse?: boolean
  noRespiratoryEffort?: boolean
  noHeartSounds?: boolean
  pupillaryFindings?: string | null
  neurologicFindings?: string | null
  monitoringEvidence?: string | null
}

export type CauseOfDeathLine = {
  sequence: number
  role: "immediate" | "due_to" | "underlying" | "other_significant"
  narrative: string
  icd11Code?: string | null
  icd11Title?: string | null
  clinicianConfirmed: boolean
}

export type NextOfKinNotification = {
  notified: boolean
  relationship?: string | null
  notifiedBy?: string | null
  notifiedAt?: string | null
  method?: string | null
  notes?: string | null
}

export type DeathPronouncement = {
  id: string
  tenantId: string
  facilityId: string
  patientId: string
  personId?: string | null
  encounterId: string
  status: DeathRecordStatus
  deathDateTime?: string | null
  deathTimePrecision: DeathTimePrecision
  deathTimeText?: string | null
  pronouncedAt: string
  pronouncedBy: string
  locationType: DeathLocationType
  wardId?: string | null
  bedId?: string | null
  locationText?: string | null
  resuscitationAttempted: boolean
  resuscitationStartedAt?: string | null
  resuscitationStoppedAt?: string | null
  dnrStatus?: string | null
  circumstances?: string | null
  provisionalCause?: string | null
  contributingConditions?: string | null
  externalCauseSuspected: boolean
  traumaticDeath: boolean
  suspiciousDeath: boolean
  medicolegalFlags: MedicolegalFlag[]
  findings: PronouncementFindings
  causeOfDeath: CauseOfDeathLine[]
  nextOfKin: NextOfKinNotification
  certifiedAt?: string | null
  certifiedBy?: string | null
  pronouncementDocumentId?: string | null
  deathSummaryDocumentId?: string | null
  isSynthetic: boolean
  createdAt: string
  updatedAt: string
  audit: Array<{ at: string; actorId: string; action: string; detail?: string }>
}

export type DeathSummaryContext = {
  patientDisplay: string
  synapseId?: string | null
  facilityName: string
  admissionOrEncounter: string
  diagnoses: string[]
  majorClinicalEvents: string[]
  significantInvestigations: string[]
  procedures: string[]
  medications: string[]
}

function isIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && /T/.test(value) && /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
}

export function assertDeathTime(input: {
  deathTimePrecision: DeathTimePrecision
  deathDateTime?: string | null
  deathTimeText?: string | null
}): void {
  if (!DEATH_TIME_PRECISIONS.includes(input.deathTimePrecision)) {
    throw new Error("DEATH_TIME_PRECISION_INVALID")
  }
  if (input.deathTimePrecision === "EXACT") {
    if (!input.deathDateTime || !isIsoDateTime(input.deathDateTime)) {
      throw new Error("DEATH_TIME_EXACT_REQUIRES_TIMEZONE")
    }
  }
  if (input.deathTimePrecision === "ESTIMATED") {
    if (!input.deathTimeText?.trim() && !input.deathDateTime) {
      throw new Error("DEATH_TIME_ESTIMATE_REQUIRED")
    }
    if (input.deathDateTime && !Number.isFinite(Date.parse(input.deathDateTime))) {
      throw new Error("DEATH_TIME_INVALID")
    }
  }
  if (input.deathTimePrecision === "UNKNOWN") {
    if (input.deathDateTime && isIsoDateTime(input.deathDateTime) && /T\d{2}:\d{2}:\d{2}/.test(input.deathDateTime)) {
      throw new Error("DEATH_TIME_UNKNOWN_NO_CLOCK")
    }
    if (!input.deathTimeText?.trim()) {
      throw new Error("DEATH_TIME_UNKNOWN_REASON_REQUIRED")
    }
  }
}

export function assertSameDeathTenant(record: { tenantId: string }, sessionTenantId: string): void {
  if (record.tenantId !== sessionTenantId) throw new Error("DEATH_TENANT_MISMATCH")
}

export function canCertifyDeath(params: { actorId: string; pronouncedBy: string; hasCertifyCapability: boolean }): boolean {
  return params.hasCertifyCapability
}

export function assertCanPronounce(hasPronounceCapability: boolean): void {
  if (!hasPronounceCapability) throw new Error("DEATH_PRONOUNCE_FORBIDDEN")
}

export function assertCanCertify(hasCertifyCapability: boolean): void {
  if (!hasCertifyCapability) throw new Error("DEATH_CERTIFY_FORBIDDEN")
}

export function assertSignedPronouncementImmutable(record: DeathPronouncement): void {
  if (record.status === "pronounced" || record.status === "certified" || record.status === "amended") {
    throw new Error("PRONOUNCEMENT_IMMUTABLE")
  }
}

export function createDeathPronouncement(input: {
  id?: string
  tenantId: string
  facilityId: string
  patientId: string
  personId?: string | null
  encounterId: string
  deathTimePrecision: DeathTimePrecision
  deathDateTime?: string | null
  deathTimeText?: string | null
  pronouncedBy: string
  pronouncedAt?: string
  locationType: DeathLocationType
  wardId?: string | null
  bedId?: string | null
  locationText?: string | null
  resuscitationAttempted?: boolean
  resuscitationStartedAt?: string | null
  resuscitationStoppedAt?: string | null
  dnrStatus?: string | null
  circumstances?: string | null
  provisionalCause?: string | null
  contributingConditions?: string | null
  externalCauseSuspected?: boolean
  traumaticDeath?: boolean
  suspiciousDeath?: boolean
  medicolegalFlags?: MedicolegalFlag[]
  findings?: PronouncementFindings
  causeOfDeath?: CauseOfDeathLine[]
  nextOfKin?: NextOfKinNotification
  isSynthetic?: boolean
}): DeathPronouncement {
  if (!input.tenantId || !input.facilityId) throw new Error("DEATH_TENANT_FACILITY_REQUIRED")
  if (!input.patientId || !input.encounterId) throw new Error("DEATH_PATIENT_ENCOUNTER_REQUIRED")
  if (!input.pronouncedBy) throw new Error("DEATH_PRONOUNCER_REQUIRED")
  assertDeathTime(input)
  const flags = (input.medicolegalFlags ?? []).filter((flag) => (MEDICOLEGAL_FLAGS as readonly string[]).includes(flag))
  const now = input.pronouncedAt ?? new Date().toISOString()
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    facilityId: input.facilityId,
    patientId: input.patientId,
    personId: input.personId ?? null,
    encounterId: input.encounterId,
    status: "pronounced",
    deathDateTime: input.deathTimePrecision === "UNKNOWN" ? input.deathDateTime ?? null : input.deathDateTime ?? null,
    deathTimePrecision: input.deathTimePrecision,
    deathTimeText: input.deathTimeText?.trim() || null,
    pronouncedAt: now,
    pronouncedBy: input.pronouncedBy,
    locationType: input.locationType,
    wardId: input.wardId ?? null,
    bedId: input.bedId ?? null,
    locationText: input.locationText ?? null,
    resuscitationAttempted: Boolean(input.resuscitationAttempted),
    resuscitationStartedAt: input.resuscitationStartedAt ?? null,
    resuscitationStoppedAt: input.resuscitationStoppedAt ?? null,
    dnrStatus: input.dnrStatus ?? null,
    circumstances: input.circumstances ?? null,
    provisionalCause: input.provisionalCause ?? null,
    contributingConditions: input.contributingConditions ?? null,
    externalCauseSuspected: Boolean(input.externalCauseSuspected),
    traumaticDeath: Boolean(input.traumaticDeath) || flags.includes("trauma"),
    suspiciousDeath: Boolean(input.suspiciousDeath) || flags.includes("suspected_homicide") || flags.includes("suspected_suicide"),
    medicolegalFlags: flags,
    findings: input.findings ?? {},
    causeOfDeath: normalizeCauseOfDeath(input.causeOfDeath ?? []),
    nextOfKin: input.nextOfKin ?? { notified: false },
    isSynthetic: input.isSynthetic ?? false,
    createdAt: now,
    updatedAt: now,
    audit: [{ at: now, actorId: input.pronouncedBy, action: "pronounced" }],
  }
}

export function normalizeCauseOfDeath(lines: CauseOfDeathLine[]): CauseOfDeathLine[] {
  return lines
    .filter((line) => line.narrative.trim())
    .map((line, index) => ({
      sequence: line.sequence || index + 1,
      role: line.role,
      narrative: line.narrative.trim(),
      icd11Code: line.clinicianConfirmed ? line.icd11Code ?? null : null,
      icd11Title: line.clinicianConfirmed ? line.icd11Title ?? null : null,
      clinicianConfirmed: Boolean(line.clinicianConfirmed),
    }))
}

export function certifyCauseOfDeath(
  record: DeathPronouncement,
  input: {
    certifiedBy: string
    hasCertifyCapability: boolean
    causeOfDeath: CauseOfDeathLine[]
    at?: string
  },
): DeathPronouncement {
  assertCanCertify(input.hasCertifyCapability)
  if (record.status !== "pronounced" && record.status !== "amended") {
    throw new Error("DEATH_CERTIFY_REQUIRES_PRONOUNCEMENT")
  }
  const cause = normalizeCauseOfDeath(input.causeOfDeath)
  if (!cause.some((line) => line.role === "immediate")) throw new Error("DEATH_IMMEDIATE_CAUSE_REQUIRED")
  if (!cause.some((line) => line.role === "underlying")) throw new Error("DEATH_UNDERLYING_CAUSE_REQUIRED")
  if (cause.some((line) => line.icd11Code && !line.clinicianConfirmed)) {
    throw new Error("DEATH_ICD11_REQUIRES_CLINICIAN")
  }
  const at = input.at ?? new Date().toISOString()
  return {
    ...record,
    status: "certified",
    causeOfDeath: cause,
    certifiedAt: at,
    certifiedBy: input.certifiedBy,
    updatedAt: at,
    audit: [...record.audit, { at, actorId: input.certifiedBy, action: "certified" }],
  }
}

export function recordNextOfKinNotification(
  record: DeathPronouncement,
  input: NextOfKinNotification & { actorId: string },
): DeathPronouncement {
  const at = input.notifiedAt ?? new Date().toISOString()
  return {
    ...record,
    nextOfKin: {
      notified: input.notified,
      relationship: input.relationship ?? null,
      notifiedBy: input.notifiedBy ?? input.actorId,
      notifiedAt: input.notified ? at : null,
      method: input.method ?? null,
      notes: input.notes ?? null,
    },
    updatedAt: at,
    audit: [...record.audit, { at, actorId: input.actorId, action: "next_of_kin_notified" }],
  }
}

export function deceasedDisposition(pronouncementId: string): {
  disposition: "DECEASED"
  pronouncementId: string
} {
  if (!pronouncementId) throw new Error("DEATH_DISPOSITION_REQUIRES_PRONOUNCEMENT")
  return { disposition: "DECEASED", pronouncementId }
}

/** Clinical pronouncement is valid for DECEASED even before cause-of-death certification. */
export const DECEASED_VALID_PRONOUNCEMENT_STATUSES = ["pronounced", "certified", "amended"] as const

export function assertDeceasedPronouncementBinding(params: {
  pronouncement: {
    id: string
    tenantId: string
    encounterId: string
    patientId: string
    personId?: string | null
    facilityId?: string | null
    status: DeathRecordStatus
  }
  tenantId: string
  encounterId: string
  patientId: string
  personId?: string | null
  hospitalId?: string | null
}): void {
  if (params.pronouncement.tenantId !== params.tenantId) throw new Error("DEATH_PRONOUNCEMENT_NOT_FOUND")
  if (params.pronouncement.encounterId !== params.encounterId) throw new Error("DEATH_PRONOUNCEMENT_ENCOUNTER_MISMATCH")
  if (params.pronouncement.patientId !== params.patientId) throw new Error("DEATH_PRONOUNCEMENT_PATIENT_MISMATCH")
  if (params.pronouncement.personId && params.personId && params.pronouncement.personId !== params.personId) {
    throw new Error("DEATH_PRONOUNCEMENT_PERSON_MISMATCH")
  }
  if (params.pronouncement.facilityId && params.hospitalId && params.pronouncement.facilityId !== params.hospitalId) {
    throw new Error("DEATH_PRONOUNCEMENT_FACILITY_MISMATCH")
  }
  if (!(DECEASED_VALID_PRONOUNCEMENT_STATUSES as readonly string[]).includes(params.pronouncement.status)) {
    throw new Error("DEATH_PRONOUNCEMENT_NOT_RECORDED")
  }
}

export function renderPronouncementSnapshot(record: DeathPronouncement, patientDisplay: string): string {
  const time =
    record.deathTimePrecision === "EXACT"
      ? record.deathDateTime
      : record.deathTimePrecision === "ESTIMATED"
        ? record.deathTimeText ?? record.deathDateTime
        : record.deathTimeText ?? "date known, exact time unknown"
  return [
    "DEATH PRONOUNCEMENT",
    `Patient: ${patientDisplay}`,
    `Precision: ${record.deathTimePrecision}`,
    `Time of death: ${time}`,
    `Pronounced at: ${record.pronouncedAt}`,
    `Pronounced by: ${record.pronouncedBy}`,
    `Location: ${record.locationText ?? record.locationType}`,
    `Resuscitation attempted: ${record.resuscitationAttempted ? "yes" : "no"}`,
    record.provisionalCause ? `Provisional cause: ${record.provisionalCause}` : null,
    record.medicolegalFlags.length ? `Medicolegal flags: ${record.medicolegalFlags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function renderDeathSummary(record: DeathPronouncement, context: DeathSummaryContext): string {
  return [
    "DEATH SUMMARY",
    `Patient: ${context.patientDisplay}`,
    context.synapseId ? `Synapse ID: ${context.synapseId}` : null,
    `Facility: ${context.facilityName}`,
    `Encounter: ${context.admissionOrEncounter}`,
    `Diagnoses: ${context.diagnoses.join("; ") || "none recorded"}`,
    `Major clinical events: ${context.majorClinicalEvents.join("; ") || "none recorded"}`,
    `Investigations: ${context.significantInvestigations.join("; ") || "none recorded"}`,
    `Procedures: ${context.procedures.join("; ") || "none recorded"}`,
    `Medications: ${context.medications.join("; ") || "none recorded"}`,
    `Resuscitation: ${record.resuscitationAttempted ? "attempted" : "not attempted"}`,
    `Date/time of death (${record.deathTimePrecision}): ${record.deathDateTime ?? record.deathTimeText ?? "unknown"}`,
    `Pronouncing clinician: ${record.pronouncedBy}`,
    `Provisional cause: ${record.provisionalCause ?? "not recorded"}`,
    `Contributing conditions: ${record.contributingConditions ?? "none recorded"}`,
    `Next of kin notified: ${record.nextOfKin.notified ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function deathTimelineEvents(record: DeathPronouncement): Array<{
  title: string
  summary: string
  tags: string[]
}> {
  const events = [
    {
      title: "Death pronounced",
      summary: `Precision ${record.deathTimePrecision}`,
      tags: ["death", "pronouncement"],
    },
  ]
  if (record.nextOfKin.notified) {
    events.push({
      title: "Next of kin notified",
      summary: record.nextOfKin.relationship ? `Relationship recorded` : "Notification recorded",
      tags: ["death", "next_of_kin"],
    })
  }
  return events
}

export function publicMortuaryQrPayload(bodyNumber: string): { bodyNumber: string; kind: "mortuary_tag" } {
  return { bodyNumber, kind: "mortuary_tag" }
}

export function deathPronouncementToRow(record: DeathPronouncement): Record<string, unknown> {
  return {
    id: record.id,
    tenant_id: record.tenantId,
    facility_id: record.facilityId,
    patient_id: record.patientId,
    person_id: record.personId ?? null,
    encounter_id: record.encounterId,
    status: record.status,
    death_date_time: record.deathDateTime ?? null,
    death_time_precision: record.deathTimePrecision,
    death_time_text: record.deathTimeText ?? null,
    pronounced_at: record.pronouncedAt,
    pronounced_by: record.pronouncedBy,
    location_type: record.locationType,
    ward_id: record.wardId ?? null,
    bed_id: record.bedId ?? null,
    location_text: record.locationText ?? null,
    resuscitation_attempted: record.resuscitationAttempted,
    resuscitation_started_at: record.resuscitationStartedAt ?? null,
    resuscitation_stopped_at: record.resuscitationStoppedAt ?? null,
    dnr_status: record.dnrStatus ?? null,
    circumstances: record.circumstances ?? null,
    provisional_cause: record.provisionalCause ?? null,
    contributing_conditions: record.contributingConditions ?? null,
    external_cause_suspected: record.externalCauseSuspected,
    traumatic_death: record.traumaticDeath,
    suspicious_death: record.suspiciousDeath,
    medicolegal_flags: record.medicolegalFlags,
    findings: record.findings,
    cause_of_death: record.causeOfDeath,
    next_of_kin: record.nextOfKin,
    certified_at: record.certifiedAt ?? null,
    certified_by: record.certifiedBy ?? null,
    pronouncement_document_id: record.pronouncementDocumentId ?? null,
    death_summary_document_id: record.deathSummaryDocumentId ?? null,
    is_synthetic: record.isSynthetic,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    audit: record.audit,
  }
}

export function deathPronouncementFromRow(row: Record<string, unknown>): DeathPronouncement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    facilityId: String(row.facility_id),
    patientId: String(row.patient_id),
    personId: row.person_id ? String(row.person_id) : null,
    encounterId: String(row.encounter_id),
    status: row.status as DeathRecordStatus,
    deathDateTime: row.death_date_time ? String(row.death_date_time) : null,
    deathTimePrecision: row.death_time_precision as DeathTimePrecision,
    deathTimeText: row.death_time_text ? String(row.death_time_text) : null,
    pronouncedAt: String(row.pronounced_at),
    pronouncedBy: String(row.pronounced_by),
    locationType: row.location_type as DeathLocationType,
    wardId: row.ward_id ? String(row.ward_id) : null,
    bedId: row.bed_id ? String(row.bed_id) : null,
    locationText: row.location_text ? String(row.location_text) : null,
    resuscitationAttempted: Boolean(row.resuscitation_attempted),
    resuscitationStartedAt: row.resuscitation_started_at ? String(row.resuscitation_started_at) : null,
    resuscitationStoppedAt: row.resuscitation_stopped_at ? String(row.resuscitation_stopped_at) : null,
    dnrStatus: row.dnr_status ? String(row.dnr_status) : null,
    circumstances: row.circumstances ? String(row.circumstances) : null,
    provisionalCause: row.provisional_cause ? String(row.provisional_cause) : null,
    contributingConditions: row.contributing_conditions ? String(row.contributing_conditions) : null,
    externalCauseSuspected: Boolean(row.external_cause_suspected),
    traumaticDeath: Boolean(row.traumatic_death),
    suspiciousDeath: Boolean(row.suspicious_death),
    medicolegalFlags: Array.isArray(row.medicolegal_flags) ? (row.medicolegal_flags as MedicolegalFlag[]) : [],
    findings: (row.findings as PronouncementFindings) ?? {},
    causeOfDeath: Array.isArray(row.cause_of_death) ? (row.cause_of_death as CauseOfDeathLine[]) : [],
    nextOfKin: (row.next_of_kin as NextOfKinNotification) ?? { notified: false },
    certifiedAt: row.certified_at ? String(row.certified_at) : null,
    certifiedBy: row.certified_by ? String(row.certified_by) : null,
    pronouncementDocumentId: row.pronouncement_document_id ? String(row.pronouncement_document_id) : null,
    deathSummaryDocumentId: row.death_summary_document_id ? String(row.death_summary_document_id) : null,
    isSynthetic: Boolean(row.is_synthetic),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audit: Array.isArray(row.audit) ? (row.audit as DeathPronouncement["audit"]) : [],
  }
}
