/**
 * DHIS2 aggregate export job queue (Phase 1).
 * Privacy-safe payloads only — never store PatientContextPacket.
 */

import {
  buildAggregateDataValueSet,
  createDhis2Adapter,
  createDhis2AdapterFromEnv,
  getDhis2ModeFromEnv,
  defaultLocalOrgKey,
  monthPeriodBounds,
  monthPeriodFromIso,
  rollupDiagnosesToFacts,
  type AggregateCaseFact,
  type Dhis2AdapterMode,
  type Dhis2DataElementMapping,
  type Dhis2DataValueSet,
  type Dhis2ExportJob,
  type Dhis2ExportJobStatus,
  type Dhis2OrgUnitMapping,
  type PrivacyExportPolicy,
  DEFAULT_PRIVACY_EXPORT_POLICY,
} from "@synapse/interop"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any

const MAX_ATTEMPTS = 5

export type EnqueueDhis2ExportInput = {
  tenantId: string
  facilityId?: string | null
  period: string
  orgUnit: string
  dataSet?: string | null
  facts: AggregateCaseFact[]
  orgUnitMappings?: Dhis2OrgUnitMapping[]
  dataElementMappings?: Dhis2DataElementMapping[]
  policy?: PrivacyExportPolicy
  capabilityGranted: boolean
  isSynthetic?: boolean
  createdBy?: string | null
  idempotencyKey?: string | null
  /** Force mode; defaults to env */
  mode?: Dhis2AdapterMode
}

export type ProcessDhis2JobResult = {
  jobId: string
  status: Dhis2ExportJobStatus
  recordsExported: number
  mode: Dhis2AdapterMode
  error?: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function defaultMappings(): {
  orgUnits: Dhis2OrgUnitMapping[]
  dataElements: Dhis2DataElementMapping[]
} {
  return {
    orgUnits: [],
    dataElements: [
      { icd11StemCode: "1F40", dhis2DataElementId: "DE_MALARIA_PF", hmisCode: "MAL_PF" },
      { icd11StemCode: "1F41", dhis2DataElementId: "DE_MALARIA_PV", hmisCode: "MAL_PV" },
      { icd11StemCode: "CA40", dhis2DataElementId: "DE_PNEUMONIA", hmisCode: "PNEU" },
      { icd11StemCode: "1B10", dhis2DataElementId: "DE_TB", hmisCode: "TB" },
      { icd11StemCode: "1G40", dhis2DataElementId: "DE_SEPSIS", hmisCode: "SEPSIS" },
      { icd11StemCode: "1A07", dhis2DataElementId: "DE_TYPHOID", hmisCode: "TYPH" },
      { icd11StemCode: "1C62", dhis2DataElementId: "DE_HIV", hmisCode: "HIV" },
    ].map((row) => ({ ...row, displayName: row.icd11StemCode })),
  }
}

export function buildIdempotencyKey(params: {
  tenantId: string
  period: string
  orgUnit: string
  dataSet?: string | null
}): string {
  return `dhis2:${params.tenantId}:${params.orgUnit}:${params.period}:${params.dataSet ?? "default"}`
}

export async function enqueueDhis2Export(
  db: DbClient,
  input: EnqueueDhis2ExportInput,
): Promise<{ job: Dhis2ExportJob | null; created: boolean; rejected?: string }> {
  const mode = input.mode ?? getDhis2ModeFromEnv()
  const defaults = defaultMappings()
  const built = buildAggregateDataValueSet({
    source: input.facts,
    period: input.period,
    orgUnit: input.orgUnit,
    dataSet: input.dataSet,
    orgUnitMappings: input.orgUnitMappings ?? defaults.orgUnits,
    dataElementMappings: input.dataElementMappings ?? defaults.dataElements,
    policy: input.policy ?? DEFAULT_PRIVACY_EXPORT_POLICY,
    capabilityGranted: input.capabilityGranted,
    mode,
    isSyntheticTenant: input.isSynthetic ?? false,
  })

  if (!built.ok) {
    await appendExportLog(db, {
      jobId: null,
      tenantId: input.tenantId,
      status: "rejected_policy",
      mode,
      recordsExported: 0,
      message: built.message,
      metadata: { code: built.code },
    })
    return {
      job: null,
      created: false,
      rejected: built.message,
    }
  }

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    buildIdempotencyKey({
      tenantId: input.tenantId,
      period: input.period,
      orgUnit: input.orgUnit,
      dataSet: input.dataSet,
    })

  const { data: existing } = await db
    .from("dhis2_export_jobs")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existing) {
    return { job: mapJobRow(existing), created: false }
  }

  const stamp = nowIso()
  const row = {
    tenant_id: input.tenantId,
    facility_id: input.facilityId ?? null,
    status: "pending",
    mode,
    period: input.period,
    org_unit: input.orgUnit,
    data_set: input.dataSet ?? null,
    payload: built.dataValueSet,
    idempotency_key: idempotencyKey,
    attempt_count: 0,
    last_error: null,
    is_synthetic: input.isSynthetic ?? false,
    created_by: input.createdBy ?? null,
    created_at: stamp,
    updated_at: stamp,
  }

  const { data, error } = await db.from("dhis2_export_jobs").insert(row).select("*").single()
  if (error) throw new Error(error.message)

  const job = mapJobRow(data)
  await appendExportLog(db, {
    jobId: job.id,
    tenantId: job.tenantId,
    status: "queued",
    mode: job.mode,
    recordsExported: job.payload.dataValues.length,
    message: "Aggregate export enqueued",
    metadata: { suppressedCells: built.suppressedCells, sourceFactCount: built.sourceFactCount },
  })

  // Keep legacy monitor table in sync for existing UI queries
  await db.from("dhis2_export_log").insert({
    tenant_id: job.tenantId,
    export_date: job.period.length === 6 ? `${job.period.slice(0, 4)}-${job.period.slice(4, 6)}-01` : job.period.slice(0, 10),
    records_exported: job.payload.dataValues.length,
    status: "pending",
    error_message: null,
    created_at: stamp,
    job_id: job.id,
  }).then(() => undefined).catch(() => undefined)

  return { job, created: true }
}

export async function processDhis2ExportJob(
  db: DbClient,
  jobId: string,
  options?: { capabilityGranted?: boolean },
): Promise<ProcessDhis2JobResult> {
  if (options?.capabilityGranted === false) {
    return {
      jobId,
      status: "failed",
      recordsExported: 0,
      mode: getDhis2ModeFromEnv(),
      error: "Missing capability public_health.export_aggregate",
    }
  }

  const { data: row, error } = await db.from("dhis2_export_jobs").select("*").eq("id", jobId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error("JOB_NOT_FOUND")

  const job = mapJobRow(row)
  if (job.status === "succeeded") {
    return {
      jobId: job.id,
      status: "succeeded",
      recordsExported: job.payload.dataValues.length,
      mode: job.mode,
    }
  }

  const stamp = nowIso()
  await db
    .from("dhis2_export_jobs")
    .update({ status: "running", started_at: stamp, updated_at: stamp, attempt_count: job.attemptCount + 1 })
    .eq("id", jobId)

  const effective =
    job.mode === "simulation"
      ? createDhis2Adapter({ mode: "simulation" })
      : createDhis2AdapterFromEnv()

  const push = await effective.pushDataValueSet(job.payload.dataValues, job.period, job.orgUnit, {
    dataSet: job.dataSet,
  })

  if (!push.ok) {
    const attempts = job.attemptCount + 1
    const nextStatus: Dhis2ExportJobStatus = attempts >= MAX_ATTEMPTS ? "dead" : "failed"
    await db
      .from("dhis2_export_jobs")
      .update({
        status: nextStatus,
        last_error: push.message,
        updated_at: nowIso(),
        completed_at: nextStatus === "dead" ? nowIso() : null,
      })
      .eq("id", jobId)

    await appendExportLog(db, {
      jobId,
      tenantId: job.tenantId,
      status: nextStatus,
      mode: job.mode,
      recordsExported: 0,
      message: push.message,
      metadata: { code: push.code },
    })

    await syncLegacyLog(db, job, nextStatus, push.message, 0)

    return { jobId, status: nextStatus, recordsExported: 0, mode: job.mode, error: push.message }
  }

  await db
    .from("dhis2_export_jobs")
    .update({
      status: "succeeded",
      last_error: null,
      updated_at: nowIso(),
      completed_at: nowIso(),
    })
    .eq("id", jobId)

  const records = push.data.importCount
  await appendExportLog(db, {
    jobId,
    tenantId: job.tenantId,
    status: "pushed",
    mode: push.data.mode,
    recordsExported: records,
    message: "Aggregate DataValueSet pushed",
    metadata: { remoteResponseRef: push.data.remoteResponseRef ?? null },
  })
  await syncLegacyLog(db, job, "success", null, records)

  return { jobId, status: "succeeded", recordsExported: records, mode: push.data.mode }
}

export async function retryDhis2ExportJob(
  db: DbClient,
  jobId: string,
  actorId?: string | null,
): Promise<ProcessDhis2JobResult> {
  const { data: row, error } = await db.from("dhis2_export_jobs").select("*").eq("id", jobId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error("JOB_NOT_FOUND")

  await db
    .from("dhis2_export_jobs")
    .update({
      status: "pending",
      last_error: "Retry queued",
      updated_at: nowIso(),
      completed_at: null,
    })
    .eq("id", jobId)

  await appendExportLog(db, {
    jobId,
    tenantId: String(row.tenant_id),
    status: "queued",
    mode: String(row.mode) as Dhis2AdapterMode,
    recordsExported: 0,
    message: "Retry queued",
    metadata: { actorId: actorId ?? null },
  })

  return processDhis2ExportJob(db, jobId, { capabilityGranted: true })
}

export async function listRecentDhis2Jobs(
  db: DbClient,
  limit = 50,
): Promise<Dhis2ExportJob[]> {
  const { data, error } = await db
    .from("dhis2_export_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapJobRow)
}

/** Signed encounter diagnoses for a tenant/month — input to privacy rollup only. */
export async function fetchSignedDiagnosisStemsForPeriod(
  db: DbClient,
  tenantId: string,
  period: string,
): Promise<Array<{ stem_code: string; encounter_id: string }>> {
  const { start, end } = monthPeriodBounds(period)
  const { data: encounters, error: encError } = await db
    .from("encounters")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_signed", true)
    .gte("signed_at", start)
    .lt("signed_at", end)

  if (encError) throw new Error(encError.message)
  const encounterIds = (encounters ?? []).map((row: { id: string }) => row.id)
  if (encounterIds.length === 0) return []

  const { data: diagnoses, error: dxError } = await db
    .from("encounter_diagnoses")
    .select("stem_code, encounter_id")
    .eq("tenant_id", tenantId)
    .eq("is_deleted", false)
    .in("encounter_id", encounterIds)

  if (dxError) throw new Error(dxError.message)
  return (diagnoses ?? []) as Array<{ stem_code: string; encounter_id: string }>
}

export type ScheduleRollupResult = {
  scheduled: boolean
  jobId?: string
  refreshed?: boolean
  reason?: string
  period?: string
}

/**
 * Phase 2: after EncounterSigned, rebuild monthly aggregate for tenant and queue export.
 * Best-effort — never blocks clinical sign path.
 */
export async function scheduleDhis2RollupAfterEncounterSign(
  db: DbClient,
  params: {
    tenantId: string
    hospitalId: string
    signedAt: string
    orgUnit?: string | null
    processImmediately?: boolean
    isSynthetic?: boolean
  },
): Promise<ScheduleRollupResult> {
  const period = monthPeriodFromIso(params.signedAt)
  const localOrgKey = defaultLocalOrgKey(params.tenantId, params.hospitalId)
  const orgUnit = params.orgUnit?.trim() || localOrgKey

  const stems = await fetchSignedDiagnosisStemsForPeriod(db, params.tenantId, period)
  const facts = rollupDiagnosesToFacts(stems, { localOrgKey, period })
  if (facts.length === 0) {
    return { scheduled: false, reason: "no_verified_diagnoses_in_period", period }
  }

  const enqueued = await enqueueOrRefreshDhis2Export(db, {
    tenantId: params.tenantId,
    facilityId: params.hospitalId,
    period,
    orgUnit,
    facts,
    capabilityGranted: true,
    isSynthetic: params.isSynthetic ?? false,
    createdBy: null,
    mode: getDhis2ModeFromEnv(),
  })

  if (!enqueued.job) {
    return { scheduled: false, reason: enqueued.rejected ?? "enqueue_failed", period }
  }

  if (params.processImmediately) {
    await processDhis2ExportJob(db, enqueued.job.id, { capabilityGranted: true })
  }

  return {
    scheduled: true,
    jobId: enqueued.job.id,
    refreshed: !enqueued.created,
    period,
  }
}

/** Process pending/failed jobs oldest-first (cron / manual drain). */
export async function processPendingDhis2Exports(
  db: DbClient,
  options?: { limit?: number },
): Promise<ProcessDhis2JobResult[]> {
  const limit = options?.limit ?? 20
  const { data, error } = await db
    .from("dhis2_export_jobs")
    .select("id")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const results: ProcessDhis2JobResult[] = []
  for (const row of data ?? []) {
    results.push(await processDhis2ExportJob(db, String(row.id), { capabilityGranted: true }))
  }
  return results
}

async function enqueueOrRefreshDhis2Export(
  db: DbClient,
  input: EnqueueDhis2ExportInput,
): Promise<{ job: Dhis2ExportJob | null; created: boolean; rejected?: string }> {
  const mode = input.mode ?? getDhis2ModeFromEnv()
  const defaults = defaultMappings()
  const built = buildAggregateDataValueSet({
    source: input.facts,
    period: input.period,
    orgUnit: input.orgUnit,
    dataSet: input.dataSet,
    orgUnitMappings: input.orgUnitMappings ?? defaults.orgUnits,
    dataElementMappings: input.dataElementMappings ?? defaults.dataElements,
    policy: input.policy ?? DEFAULT_PRIVACY_EXPORT_POLICY,
    capabilityGranted: input.capabilityGranted,
    mode,
    isSyntheticTenant: input.isSynthetic ?? false,
  })

  if (!built.ok) {
    return { job: null, created: false, rejected: built.message }
  }

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    buildIdempotencyKey({
      tenantId: input.tenantId,
      period: input.period,
      orgUnit: input.orgUnit,
      dataSet: input.dataSet,
    })

  const { data: existing } = await db
    .from("dhis2_export_jobs")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  const stamp = nowIso()
  if (existing) {
    const { data: updated, error } = await db
      .from("dhis2_export_jobs")
      .update({
        payload: built.dataValueSet,
        status: "pending",
        last_error: null,
        completed_at: null,
        updated_at: stamp,
      })
      .eq("id", existing.id)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return { job: mapJobRow(updated), created: false }
  }

  const row = {
    tenant_id: input.tenantId,
    facility_id: input.facilityId ?? null,
    status: "pending",
    mode,
    period: input.period,
    org_unit: input.orgUnit,
    data_set: input.dataSet ?? null,
    payload: built.dataValueSet,
    idempotency_key: idempotencyKey,
    attempt_count: 0,
    last_error: null,
    is_synthetic: input.isSynthetic ?? false,
    created_by: input.createdBy ?? null,
    created_at: stamp,
    updated_at: stamp,
  }

  const { data, error } = await db.from("dhis2_export_jobs").insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return { job: mapJobRow(data), created: true }
}

async function appendExportLog(
  db: DbClient,
  entry: {
    jobId: string | null
    tenantId: string
    status: string
    mode: Dhis2AdapterMode
    recordsExported: number
    message?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await db
    .from("dhis2_export_attempt_log")
    .insert({
      job_id: entry.jobId,
      tenant_id: entry.tenantId,
      status: entry.status,
      mode: entry.mode,
      records_exported: entry.recordsExported,
      message: entry.message ?? null,
      metadata: entry.metadata ?? {},
      created_at: nowIso(),
    })
    .then(() => undefined)
    .catch(() => undefined)
}

async function syncLegacyLog(
  db: DbClient,
  job: Dhis2ExportJob,
  status: string,
  errorMessage: string | null,
  records: number,
) {
  const exportDate =
    job.period.length === 6
      ? `${job.period.slice(0, 4)}-${job.period.slice(4, 6)}-01`
      : job.period.slice(0, 10)
  await db
    .from("dhis2_export_log")
    .insert({
      tenant_id: job.tenantId,
      export_date: exportDate,
      records_exported: records,
      status,
      error_message: errorMessage,
      created_at: nowIso(),
      job_id: job.id,
    })
    .then(() => undefined)
    .catch(() => undefined)
}

function mapJobRow(row: Record<string, unknown>): Dhis2ExportJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    facilityId: (row.facility_id as string | null) ?? null,
    status: row.status as Dhis2ExportJobStatus,
    mode: row.mode as Dhis2AdapterMode,
    period: String(row.period),
    orgUnit: String(row.org_unit),
    dataSet: (row.data_set as string | null) ?? null,
    payload: row.payload as Dhis2DataValueSet,
    idempotencyKey: String(row.idempotency_key),
    attemptCount: Number(row.attempt_count ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    isSynthetic: Boolean(row.is_synthetic),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  }
}

/** In-memory queue for CI / unit tests without Supabase. */
export class InMemoryDhis2ExportQueue {
  jobs = new Map<string, Dhis2ExportJob>()
  logs: Array<Record<string, unknown>> = []

  enqueue(input: EnqueueDhis2ExportInput): { job: Dhis2ExportJob | null; created: boolean; rejected?: string } {
    const mode = input.mode ?? "simulation"
    const defaults = defaultMappings()
    const built = buildAggregateDataValueSet({
      source: input.facts,
      period: input.period,
      orgUnit: input.orgUnit,
      dataSet: input.dataSet,
      orgUnitMappings: input.orgUnitMappings ?? defaults.orgUnits,
      dataElementMappings: input.dataElementMappings ?? defaults.dataElements,
      policy: input.policy ?? DEFAULT_PRIVACY_EXPORT_POLICY,
      capabilityGranted: input.capabilityGranted,
      mode,
      isSyntheticTenant: input.isSynthetic ?? false,
    })
    if (!built.ok) return { job: null, created: false, rejected: built.message }

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      buildIdempotencyKey({
        tenantId: input.tenantId,
        period: input.period,
        orgUnit: input.orgUnit,
        dataSet: input.dataSet,
      })
    for (const existing of this.jobs.values()) {
      if (existing.idempotencyKey === idempotencyKey) {
        existing.payload = built.dataValueSet
        existing.status = "pending"
        existing.lastError = null
        existing.updatedAt = nowIso()
        existing.completedAt = null
        return { job: existing, created: false }
      }
    }
    const stamp = nowIso()
    const job: Dhis2ExportJob = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      facilityId: input.facilityId ?? null,
      status: "pending",
      mode,
      period: input.period,
      orgUnit: input.orgUnit,
      dataSet: input.dataSet ?? null,
      payload: built.dataValueSet,
      idempotencyKey,
      attemptCount: 0,
      lastError: null,
      isSynthetic: input.isSynthetic ?? false,
      createdBy: input.createdBy ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    }
    this.jobs.set(job.id, job)
    this.logs.push({ jobId: job.id, status: "queued", at: stamp })
    return { job, created: true }
  }

  async process(jobId: string): Promise<ProcessDhis2JobResult> {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error("JOB_NOT_FOUND")
    job.status = "running"
    job.attemptCount += 1
    job.startedAt = nowIso()
    const adapter = createDhis2Adapter({ mode: "simulation" })
    const push = await adapter.pushDataValueSet(job.payload.dataValues, job.period, job.orgUnit, {
      dataSet: job.dataSet,
    })
    if (!push.ok) {
      job.status = job.attemptCount >= MAX_ATTEMPTS ? "dead" : "failed"
      job.lastError = push.message
      return { jobId, status: job.status, recordsExported: 0, mode: job.mode, error: push.message }
    }
    job.status = "succeeded"
    job.completedAt = nowIso()
    this.logs.push({ jobId, status: "pushed", records: push.data.importCount })
    return { jobId, status: "succeeded", recordsExported: push.data.importCount, mode: "simulation" }
  }

  listPending(): Dhis2ExportJob[] {
    return [...this.jobs.values()].filter((job) => job.status === "pending" || job.status === "failed")
  }

  async processPending(limit = 20): Promise<ProcessDhis2JobResult[]> {
    const results: ProcessDhis2JobResult[] = []
    for (const job of this.listPending().slice(0, limit)) {
      results.push(await this.process(job.id))
    }
    return results
  }
}
