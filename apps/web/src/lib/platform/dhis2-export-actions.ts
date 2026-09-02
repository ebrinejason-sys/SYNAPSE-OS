/**
 * Platform DHIS2 aggregate export actions.
 * Capability: public_health.export_aggregate (platform_admin always allowed).
 */

import {
  createDhis2AdapterFromEnv,
  fixtureAggregateFacts,
  getDhis2ModeFromEnv,
} from "@synapse/interop"
import {
  enqueueDhis2Export,
  listRecentDhis2Jobs,
  processDhis2ExportJob,
  processPendingDhis2Exports,
  retryDhis2ExportJob,
  InMemoryDhis2ExportQueue,
} from "@synapse/db/dhis2-export"
import { createServiceClient } from "@/lib/supabase/server"
import { logPlatformEvent } from "@/app/platform/_lib/platform-data"

const DEMO_TENANT = "00000000-0000-4000-8000-000000000001"

/** Module-level fallback when DB tables are unavailable (local/CI). */
const memoryQueue = new InMemoryDhis2ExportQueue()

export function resolveDhis2Capability(role: string): boolean {
  if (role === "platform_admin" || role === "super_admin") return true
  // Mirror capability-map public_health.export_aggregate
  return role === "hospital_admin" || role === "dho" || role === "epidemiologist"
}

export async function triggerAggregateExport(params: {
  actorId: string
  actorRole: string
  tenantId?: string | null
  period?: string | null
  orgUnit?: string | null
}): Promise<{
  ok: boolean
  mode: string
  jobId?: string
  recordsExported?: number
  error?: string
  storage: "db" | "memory"
}> {
  if (!resolveDhis2Capability(params.actorRole)) {
    return { ok: false, mode: getDhis2ModeFromEnv(), error: "Missing capability public_health.export_aggregate", storage: "memory" }
  }

  const period = params.period?.trim() || currentMonthPeriod()
  const orgUnit = params.orgUnit?.trim() || "OU_SIM_FACILITY"
  const tenantId = params.tenantId?.trim() || DEMO_TENANT
  const mode = getDhis2ModeFromEnv()

  const facts = fixtureAggregateFacts().map((f) => ({ ...f, period, localOrgKey: orgUnit }))

  try {
    const db = createServiceClient()
    const enqueued = await enqueueDhis2Export(db, {
      tenantId,
      period,
      orgUnit,
      facts,
      capabilityGranted: true,
      isSynthetic: tenantId === DEMO_TENANT || mode === "simulation",
      createdBy: params.actorId,
      mode,
    })

    if (enqueued.rejected || !enqueued.job) {
      await logPlatformEvent({
        actorId: params.actorId,
        action: "dhis2.export_rejected",
        entityType: "dhis2_export",
        tenantId,
        metadata: { reason: enqueued.rejected, period, orgUnit, mode },
      })
      return { ok: false, mode, error: enqueued.rejected ?? "enqueue_failed", storage: "db" }
    }

    const processed = await processDhis2ExportJob(db, enqueued.job.id, { capabilityGranted: true })
    await logPlatformEvent({
      actorId: params.actorId,
      action: "dhis2.export_aggregate",
      entityType: "dhis2_export_jobs",
      entityId: processed.jobId,
      tenantId,
      metadata: {
        status: processed.status,
        recordsExported: processed.recordsExported,
        mode: processed.mode,
        period,
        orgUnit,
      },
    })

    return {
      ok: processed.status === "succeeded",
      mode: processed.mode,
      jobId: processed.jobId,
      recordsExported: processed.recordsExported,
      error: processed.error ?? undefined,
      storage: "db",
    }
  } catch {
    // Tables missing or DB unreachable — simulation memory path for platform monitor / CI
    const enqueued = memoryQueue.enqueue({
      tenantId,
      period,
      orgUnit,
      facts,
      capabilityGranted: true,
      isSynthetic: true,
      createdBy: params.actorId,
      mode: "simulation",
    })
    if (!enqueued.job) {
      return { ok: false, mode: "simulation", error: enqueued.rejected ?? "enqueue_failed", storage: "memory" }
    }
    const processed = await memoryQueue.process(enqueued.job.id)
    await logPlatformEvent({
      actorId: params.actorId,
      action: "dhis2.export_aggregate_simulation",
      entityType: "dhis2_export_jobs",
      entityId: processed.jobId,
      tenantId,
      metadata: {
        status: processed.status,
        recordsExported: processed.recordsExported,
        mode: "simulation",
        storage: "memory",
        period,
        orgUnit,
      },
    })
    return {
      ok: processed.status === "succeeded",
      mode: "simulation",
      jobId: processed.jobId,
      recordsExported: processed.recordsExported,
      error: processed.error ?? undefined,
      storage: "memory",
    }
  }
}

export async function retryExportJob(params: {
  actorId: string
  actorRole: string
  jobId: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!resolveDhis2Capability(params.actorRole)) {
    return { ok: false, error: "Missing capability public_health.export_aggregate" }
  }
  try {
    const db = createServiceClient()
    const result = await retryDhis2ExportJob(db, params.jobId, params.actorId)
    await logPlatformEvent({
      actorId: params.actorId,
      action: "dhis2.export_retry",
      entityType: "dhis2_export_jobs",
      entityId: params.jobId,
      metadata: { status: result.status, mode: result.mode },
    })
    return { ok: result.status === "succeeded", error: result.error ?? undefined }
  } catch (err) {
    const mem = await memoryQueue.process(params.jobId).catch(() => null)
    if (mem) return { ok: mem.status === "succeeded", error: mem.error ?? undefined }
    return { ok: false, error: err instanceof Error ? err.message : "retry_failed" }
  }
}

export async function processPendingExports(params: {
  actorId: string
  actorRole: string
  limit?: number
}): Promise<{
  ok: boolean
  processed: number
  succeeded: number
  failed: number
  storage: "db" | "memory"
}> {
  if (!resolveDhis2Capability(params.actorRole)) {
    return { ok: false, processed: 0, succeeded: 0, failed: 0, storage: "memory" }
  }

  const limit = params.limit ?? 25
  try {
    const db = createServiceClient()
    const results = await processPendingDhis2Exports(db, { limit })
    const succeeded = results.filter((row) => row.status === "succeeded").length
    const failed = results.filter((row) => row.status === "failed" || row.status === "dead").length
    await logPlatformEvent({
      actorId: params.actorId,
      action: "dhis2.process_pending",
      entityType: "dhis2_export_jobs",
      metadata: { processed: results.length, succeeded, failed, limit },
    })
    return { ok: true, processed: results.length, succeeded, failed, storage: "db" }
  } catch {
    const results = await memoryQueue.processPending(limit)
    const succeeded = results.filter((row) => row.status === "succeeded").length
    const failed = results.filter((row) => row.status === "failed" || row.status === "dead").length
    return { ok: true, processed: results.length, succeeded, failed, storage: "memory" }
  }
}

export async function loadDhis2MonitorState() {
  const mode = getDhis2ModeFromEnv()
  const adapter = createDhis2AdapterFromEnv()
  const health = await adapter.healthCheck()

  try {
    const db = createServiceClient()
    const jobs = await listRecentDhis2Jobs(db, 80)
    return { mode, health, jobs, storage: "db" as const }
  } catch {
    return {
      mode,
      health,
      jobs: [...memoryQueue.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      storage: "memory" as const,
    }
  }
}

function currentMonthPeriod(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${y}${m}`
}
