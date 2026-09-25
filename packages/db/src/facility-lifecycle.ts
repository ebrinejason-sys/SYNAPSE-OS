export const FACILITY_LIFECYCLE_STATES = [
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
  "DELETION_PENDING",
  "DELETED",
] as const

export type FacilityLifecycleState = (typeof FACILITY_LIFECYCLE_STATES)[number]

export type FacilityLifecycleAction =
  | "suspend"
  | "resume"
  | "archive"
  | "restore"
  | "request_delete"
  | "cancel_delete"
  | "purge"

const TRANSITIONS: Record<FacilityLifecycleState, Partial<Record<FacilityLifecycleAction, FacilityLifecycleState>>> = {
  ACTIVE: { suspend: "SUSPENDED", archive: "ARCHIVED", request_delete: "DELETION_PENDING" },
  SUSPENDED: { resume: "ACTIVE", archive: "ARCHIVED", request_delete: "DELETION_PENDING" },
  ARCHIVED: { restore: "ACTIVE", request_delete: "DELETION_PENDING" },
  DELETION_PENDING: { cancel_delete: "ARCHIVED", purge: "DELETED" },
  DELETED: {},
}

export const EMPTY_LIFECYCLE_COUNTS = {
  staffExclusive: 0,
  staffShared: 0,
  patients: 0,
  encounters: 0,
  invoices: 0,
  prescriptions: 0,
  labOrders: 0,
  payments: 0,
  subscriptions: 0,
  signedDocuments: 0,
  referrals: 0,
  deathRecords: 0,
  mortuaryRecords: 0,
  auditEvents: 0,
  devices: 0,
  memberships: 0,
} as const

export type LifecycleCounts = { -readonly [K in keyof typeof EMPTY_LIFECYCLE_COUNTS]: number }

export type LifecycleImpactPreview = {
  tenantId: string
  currentState: FacilityLifecycleState
  action: FacilityLifecycleAction
  nextState: FacilityLifecycleState | null
  allowed: boolean
  hardPurgeAllowed: boolean
  retainClinicalHistory: boolean
  retainFinancialHistory: boolean
  retainAuditHistory: boolean
  blockers: string[]
  counts: LifecycleCounts
}

export function normalizeLifecycleState(value: string | null | undefined, isActive = true): FacilityLifecycleState {
  const raw = String(value ?? "").toUpperCase()
  if ((FACILITY_LIFECYCLE_STATES as readonly string[]).includes(raw)) return raw as FacilityLifecycleState
  if (raw === "SUSPENDED" || isActive === false) return "SUSPENDED"
  return "ACTIVE"
}

export function nextFacilityLifecycleState(
  current: FacilityLifecycleState,
  action: FacilityLifecycleAction,
): FacilityLifecycleState | null {
  return TRANSITIONS[current][action] ?? null
}

export function previewFacilityLifecycle(params: {
  tenantId: string
  currentState: FacilityLifecycleState
  action: FacilityLifecycleAction
  isSynthetic?: boolean
  allowHardPurge?: boolean
  counts?: Partial<LifecycleImpactPreview["counts"]>
}): LifecycleImpactPreview {
  const nextState = nextFacilityLifecycleState(params.currentState, params.action)
  const counts: LifecycleCounts = { ...EMPTY_LIFECYCLE_COUNTS, ...params.counts }
  const blockers: string[] = []
  if (!nextState) blockers.push(`Action ${params.action} is not valid from ${params.currentState}`)
  const retainClinicalHistory =
    counts.patients > 0 ||
    counts.encounters > 0 ||
    counts.prescriptions > 0 ||
    counts.labOrders > 0 ||
    counts.signedDocuments > 0 ||
    counts.referrals > 0 ||
    counts.deathRecords > 0 ||
    counts.mortuaryRecords > 0
  const retainFinancialHistory = counts.invoices > 0 || counts.payments > 0 || counts.subscriptions > 0
  const retainAuditHistory = counts.auditEvents > 0
  const hardPurgeAllowed = params.action === "purge"
    ? Boolean(
        params.allowHardPurge &&
          params.isSynthetic &&
          !retainClinicalHistory &&
          !retainFinancialHistory &&
          !retainAuditHistory,
      )
    : false
  if (params.action === "purge" && !params.isSynthetic) {
    blockers.push("Permanent purge is limited to synthetic or disposable test facilities")
  }
  if (params.action === "purge" && !params.allowHardPurge) {
    blockers.push("Hard purge is disabled until SYNAPSE_ALLOW_HARD_PURGE is set on the server")
  }
  if (params.action === "purge" && (retainClinicalHistory || retainFinancialHistory || retainAuditHistory)) {
    blockers.push("Protected clinical, financial, or audit records require retention. Archive or suspend instead of purging.")
  }
  return {
    tenantId: params.tenantId,
    currentState: params.currentState,
    action: params.action,
    nextState: params.action === "purge" && !hardPurgeAllowed ? null : nextState,
    allowed: blockers.length === 0 && nextState != null && (params.action !== "purge" || hardPurgeAllowed),
    hardPurgeAllowed,
    retainClinicalHistory,
    retainFinancialHistory,
    retainAuditHistory,
    blockers,
    counts,
  }
}

/** Server-side confirmation. Frontend visibility is not authorization. */
export function assertPurgeConfirmation(input: {
  facilityName: string
  facilityId: string
  typedConfirmation?: string | null
  acknowledged?: boolean
}): { ok: true } | { ok: false; error: string } {
  if (input.acknowledged !== true) {
    return { ok: false, error: "Explicit acknowledgement required before purge" }
  }
  const typed = String(input.typedConfirmation ?? "").trim()
  const name = input.facilityName.trim()
  const id = input.facilityId.trim()
  if (!typed || (typed !== name && typed !== id)) {
    return { ok: false, error: "Type the facility name or ID exactly to confirm purge" }
  }
  return { ok: true }
}
