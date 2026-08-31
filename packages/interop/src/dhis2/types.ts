/**
 * DHIS2 outbound aggregate export contracts (Phase 0–1).
 * Tracker / FHIR façade intentionally omitted — stub hooks only.
 */

export const DHIS2_EXPORT_JOB_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "dead",
] as const

export type Dhis2ExportJobStatus = (typeof DHIS2_EXPORT_JOB_STATUSES)[number]

export const DHIS2_ADAPTER_MODES = ["live", "simulation"] as const
export type Dhis2AdapterMode = (typeof DHIS2_ADAPTER_MODES)[number]

export const DHIS2_PERIOD_GRAINS = ["daily", "weekly", "monthly"] as const
export type Dhis2PeriodGrain = (typeof DHIS2_PERIOD_GRAINS)[number]

/** Single aggregate cell — never contains patient identifiers. */
export type Dhis2DataValue = {
  dataElement: string
  orgUnit: string
  period: string
  value: string
  categoryOptionCombo?: string
  attributeOptionCombo?: string
  comment?: string
}

export type Dhis2DataValueSet = {
  dataSet?: string
  period: string
  orgUnit: string
  dataValues: Dhis2DataValue[]
}

export type Dhis2OrgUnitMapping = {
  tenantId: string
  facilityId?: string | null
  /** Local facility / hospital key used in SYNAPSE */
  localOrgKey: string
  /** DHIS2 organisation unit UID */
  dhis2OrgUnitId: string
  displayName?: string | null
}

export type Dhis2DataElementMapping = {
  /** Verified ICD-11 MMS stem code (terminology service only) */
  icd11StemCode: string
  dhis2DataElementId: string
  displayName?: string | null
  /** Optional MoH / HMIS indicator code */
  hmisCode?: string | null
}

/**
 * Privacy gate for outbound public-health exports.
 * Identifiable patient data is never allowed on the aggregate path.
 */
export type PrivacyExportPolicy = {
  /** Always false for aggregate DataValueSets */
  allowIdentifiable: false
  periodGrain: Dhis2PeriodGrain
  forbidFreeText: true
  forbidExactTimestamps: true
  forbidNamesAndIds: true
  /** Suppress cells below this count (k-anonymity). 1 = no suppress. */
  minCellCount: number
  /** Capability required before enqueue / push */
  requiredCapability: "public_health.export_aggregate"
  /** Synthetic / demo tenants must never hit live DHIS2 */
  blockSyntheticTenantsFromLive: true
}

export const DEFAULT_PRIVACY_EXPORT_POLICY: PrivacyExportPolicy = {
  allowIdentifiable: false,
  periodGrain: "monthly",
  forbidFreeText: true,
  forbidExactTimestamps: true,
  forbidNamesAndIds: true,
  minCellCount: 1,
  requiredCapability: "public_health.export_aggregate",
  blockSyntheticTenantsFromLive: true,
}

export type Dhis2ExportJob = {
  id: string
  tenantId: string
  facilityId?: string | null
  status: Dhis2ExportJobStatus
  mode: Dhis2AdapterMode
  period: string
  orgUnit: string
  dataSet?: string | null
  /** Privacy-safe payload only */
  payload: Dhis2DataValueSet
  idempotencyKey: string
  attemptCount: number
  lastError?: string | null
  isSynthetic: boolean
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  completedAt?: string | null
}

export type Dhis2ExportLogEntry = {
  id: string
  jobId: string
  tenantId: string
  status: Dhis2ExportJobStatus | "queued" | "pushed" | "rejected_policy"
  mode: Dhis2AdapterMode
  recordsExported: number
  message?: string | null
  /** Redacted audit metadata — never raw packets */
  metadata?: Record<string, unknown>
  createdAt: string
}

export type Dhis2PushResult = {
  importCount: number
  ignored?: number
  mode: Dhis2AdapterMode
  remoteResponseRef?: string | null
}

export type Dhis2HealthStatus = {
  ok: boolean
  mode: Dhis2AdapterMode
  status: "healthy" | "degraded" | "down" | "simulation" | "not_configured"
  detail?: string
  checkedAt: string
}

/**
 * Narrow outbound adapter. Separated from HealthcareAdapter so clinical
 * inbound translation is never mixed with public-health aggregates.
 */
export interface Dhis2Adapter {
  readonly mode: Dhis2AdapterMode
  pushDataValueSet(
    values: Dhis2DataValue[],
    period: string,
    orgUnit: string,
    options?: { dataSet?: string | null },
  ): Promise<{ ok: true; data: Dhis2PushResult } | { ok: false; code: string; message: string }>
  healthCheck(): Promise<Dhis2HealthStatus>
}

/** Phase 2+ stub — Tracker events not implemented. */
export type Dhis2TrackerStub = {
  pushTrackedEntity?: never
  pushEvent?: never
}
