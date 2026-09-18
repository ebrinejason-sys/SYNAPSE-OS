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

export type LifecycleImpactPreview = {
  tenantId: string
  currentState: FacilityLifecycleState
  action: FacilityLifecycleAction
  nextState: FacilityLifecycleState | null
  allowed: boolean
  hardPurgeAllowed: boolean
  retainClinicalHistory: boolean
  retainFinancialHistory: boolean
  blockers: string[]
  counts: {
    staffExclusive: number
    staffShared: number
    patients: number
    encounters: number
    invoices: number
  }
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
  const counts = {
    staffExclusive: 0,
    staffShared: 0,
    patients: 0,
    encounters: 0,
    invoices: 0,
    ...params.counts,
  }
  const blockers: string[] = []
  if (!nextState) blockers.push(`Action ${params.action} is not valid from ${params.currentState}`)
  const retainClinicalHistory = counts.encounters > 0 || counts.patients > 0
  const retainFinancialHistory = counts.invoices > 0
  const hardPurgeAllowed = params.action === "purge"
    ? Boolean(params.allowHardPurge && params.isSynthetic && !retainClinicalHistory && !retainFinancialHistory)
    : false
  if (params.action === "purge" && !hardPurgeAllowed) {
    blockers.push("Hard purge is synthetic/test only and blocked when clinical or financial history exists")
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
    blockers,
    counts,
  }
}
