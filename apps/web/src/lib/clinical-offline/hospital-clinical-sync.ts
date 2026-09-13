/**
 * Hospital web clinical offline bridge — reuses SyncRuntime + SyncCommand builders.
 * Flush target: POST /api/hospital/sync/apply (authenticated session cookies).
 * Local queue write is NEVER presented as server-saved.
 */

'use client'

import { SyncRuntime, classifyApplyHttpFailure, type SyncApplyResult, type SyncFlushSummary } from '@synapse/db/sync-runtime'
import { buildWriteupSyncCommand } from '@synapse/db/clinical-offline-writeup'
import { buildDispositionSyncCommand } from '@synapse/db/clinical-offline-disposition'
import { buildTriageSyncCommand } from '@synapse/db/clinical-offline-triage'
import { buildPrescribeSyncCommand } from '@synapse/db/clinical-offline-prescribe'
import type { ClinicalWriteup } from '@synapse/db/clinical-writeup'
import type { SyncCommand } from '@synapse/db/sync-contract'
import {
  LocalStorageSyncOutboxStore,
  clearHospitalClinicalOutbox,
  discardParkedHospitalClinicalOutbox,
  getOrCreateHospitalDeviceId,
  getParkedHospitalClinicalCount,
  parkHospitalClinicalOutbox,
  restoreParkedHospitalClinicalOutbox,
} from './local-storage-outbox-store'

export type HospitalClinicalSyncContext = {
  tenantId: string
  facilityId: string
  actorId: string
}

export type QueueWriteupResult =
  | { ok: true; state: 'queued'; commandId: string; offline: true }
  | { ok: false; error: string }

function runtimeFor(ctx: HospitalClinicalSyncContext): SyncRuntime {
  const store = new LocalStorageSyncOutboxStore(ctx.tenantId, ctx.actorId)
  return new SyncRuntime(ctx.tenantId, store)
}

export async function queueWriteupOffline(
  ctx: HospitalClinicalSyncContext,
  input: {
    encounterId: string
    writeup: Partial<ClinicalWriteup>
    commandId?: string
    baseRevision?: number | null
  },
): Promise<QueueWriteupResult> {
  try {
    const command = await buildWriteupSyncCommand({
      commandId: input.commandId,
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      deviceId: getOrCreateHospitalDeviceId(),
      actorId: ctx.actorId,
      encounterId: input.encounterId,
      writeup: input.writeup,
      baseRevision: input.baseRevision ?? null,
    })
    const runtime = runtimeFor(ctx)
    const record = await runtime.commit(command)
    return { ok: true, state: 'queued', commandId: record.command.commandId, offline: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFFLINE_QUEUE_FAILED' }
  }
}

async function applyViaHospitalApi(command: SyncCommand): Promise<SyncApplyResult> {
  let response: Response
  try {
    response = await fetch('/api/hospital/sync/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
  } catch (error) {
    return {
      outcome: 'retry',
      error: error instanceof Error ? error.message : 'NETWORK_ERROR',
    }
  }

  const body = (await response.json().catch(() => ({}))) as {
    outcome?: string
    commandId?: string
    serverAckId?: string
    checkpoint?: string
    result?: unknown
    error?: string
    conflict?: { reason?: string }
  }

  if (response.ok) {
    const outcome = body.outcome === 'replay' ? 'replay' : 'applied'
    return {
      outcome,
      serverAckId: String(body.serverAckId ?? body.commandId ?? command.commandId),
      checkpoint: String(body.checkpoint ?? new Date().toISOString()),
      response: body.result ?? body,
    }
  }

  if (response.status === 409 || body.outcome === 'conflict') {
    return {
      outcome: 'conflict',
      conflict: {
        policy: 'human_review',
        reason: (body.conflict?.reason as 'idempotency_mismatch') || 'idempotency_mismatch',
      },
      error: body.error,
    }
  }

  const classified = classifyApplyHttpFailure(response.status, body.error)
  if (classified === 'rejected') {
    return { outcome: 'rejected', reason: body.error || `HTTP_${response.status}` }
  }
  return { outcome: 'retry', error: body.error || `HTTP_${response.status}` }
}

export async function flushHospitalClinicalOutbox(
  ctx: HospitalClinicalSyncContext,
  limit = 20,
): Promise<SyncFlushSummary> {
  const runtime = runtimeFor(ctx)
  return runtime.flush((command) => applyViaHospitalApi(command), limit)
}

export function pendingHospitalClinicalSummary(ctx: HospitalClinicalSyncContext) {
  return new LocalStorageSyncOutboxStore(ctx.tenantId, ctx.actorId).listPendingSummary()
}

export function clearHospitalClinicalQueueForUser(ctx: HospitalClinicalSyncContext): void {
  clearHospitalClinicalOutbox(ctx.tenantId, ctx.actorId)
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function parkHospitalClinicalQueueForUser(ctx: HospitalClinicalSyncContext) {
  return parkHospitalClinicalOutbox(ctx.tenantId, ctx.actorId)
}

export function restoreHospitalClinicalQueueForUser(ctx: HospitalClinicalSyncContext) {
  return restoreParkedHospitalClinicalOutbox(ctx.tenantId, ctx.actorId)
}

export function parkedHospitalClinicalCount(ctx: HospitalClinicalSyncContext) {
  return getParkedHospitalClinicalCount(ctx.tenantId, ctx.actorId)
}

export function discardParkedHospitalClinicalQueue(ctx: HospitalClinicalSyncContext) {
  discardParkedHospitalClinicalOutbox(ctx.tenantId, ctx.actorId)
}


export async function queueDispositionOffline(
  ctx: HospitalClinicalSyncContext,
  input: { encounterId: string; disposition: string; reason?: string | null; commandId?: string },
): Promise<QueueWriteupResult> {
  try {
    const command = await buildDispositionSyncCommand({
      commandId: input.commandId,
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      deviceId: getOrCreateHospitalDeviceId(),
      actorId: ctx.actorId,
      encounterId: input.encounterId,
      disposition: input.disposition as never,
      reason: input.reason ?? null,
    })
    const record = await runtimeFor(ctx).commit(command)
    return { ok: true, state: 'queued', commandId: record.command.commandId, offline: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFFLINE_QUEUE_FAILED' }
  }
}

export async function queueTriageOffline(
  ctx: HospitalClinicalSyncContext,
  input: {
    encounterId: string
    triage: Record<string, unknown>
    commandId?: string
  },
): Promise<QueueWriteupResult> {
  try {
    const command = await buildTriageSyncCommand({
      commandId: input.commandId,
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      deviceId: getOrCreateHospitalDeviceId(),
      actorId: ctx.actorId,
      encounterId: input.encounterId,
      triage: input.triage as never,
    })
    const record = await runtimeFor(ctx).commit(command)
    return { ok: true, state: 'queued', commandId: record.command.commandId, offline: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFFLINE_QUEUE_FAILED' }
  }
}

export async function queuePrescribeOffline(
  ctx: HospitalClinicalSyncContext,
  input: {
    encounterId: string
    patientId: string
    medicationDisplay: string
    dose: string
    quantity: number
    unit?: string
    commandId?: string
  },
): Promise<QueueWriteupResult> {
  try {
    const command = await buildPrescribeSyncCommand({
      commandId: input.commandId,
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      deviceId: getOrCreateHospitalDeviceId(),
      actorId: ctx.actorId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      medicationDisplay: input.medicationDisplay,
      dose: input.dose,
      quantity: input.quantity,
      unit: input.unit,
    })
    const record = await runtimeFor(ctx).commit(command)
    return { ok: true, state: 'queued', commandId: record.command.commandId, offline: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'OFFLINE_QUEUE_FAILED' }
  }
}
