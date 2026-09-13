/**
 * Browser localStorage-backed SyncOutboxStore for hospital clinical SyncCommands.
 * Scoped by tenantId + actorId so logout/login as another user cannot see pending work.
 * Not encrypted at rest — do not store MFA secrets or service-role credentials here.
 */

'use client'

import {
  resolveSyncConflict,
  type SyncCommand,
  type SyncConflict,
  type SyncOutboxStatus,
} from '@synapse/db/sync-contract'
import type {
  SyncApplyResult,
  SyncOutboxRecord,
  SyncOutboxStore,
  SyncPersistResult,
} from '@synapse/db/sync-runtime'

type StoredBucket = {
  records: Record<string, SyncOutboxRecord>
  checkpoints: Record<string, string>
}

const PREFIX = 'synapse.hospital.clinical.outbox.v1'

function storageKey(tenantId: string, actorId: string): string {
  return `${PREFIX}:${tenantId}:${actorId}`
}

function emptyBucket(): StoredBucket {
  return { records: {}, checkpoints: {} }
}

function readBucket(tenantId: string, actorId: string): StoredBucket {
  if (typeof window === 'undefined' || !window.localStorage) return emptyBucket()
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId, actorId))
    if (!raw) return emptyBucket()
    const parsed = JSON.parse(raw) as StoredBucket
    if (!parsed || typeof parsed !== 'object') return emptyBucket()
    return {
      records: parsed.records ?? {},
      checkpoints: parsed.checkpoints ?? {},
    }
  } catch {
    return emptyBucket()
  }
}

function writeBucket(tenantId: string, actorId: string, bucket: StoredBucket): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(storageKey(tenantId, actorId), JSON.stringify(bucket))
}

export function clearHospitalClinicalOutbox(tenantId: string, actorId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(storageKey(tenantId, actorId))
}

export function getOrCreateHospitalDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return crypto.randomUUID()
  }
  const key = 'synapse.hospital.clinical.deviceId.v1'
  const existing = window.localStorage.getItem(key)
  if (existing && existing.length >= 32) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}

export class LocalStorageSyncOutboxStore implements SyncOutboxStore {
  constructor(
    private readonly tenantId: string,
    private readonly actorId: string,
  ) {}

  async initialize(): Promise<void> {
    // localStorage is sync; ensure bucket exists
    writeBucket(this.tenantId, this.actorId, readBucket(this.tenantId, this.actorId))
  }

  private load(): StoredBucket {
    return readBucket(this.tenantId, this.actorId)
  }

  private save(bucket: StoredBucket): void {
    writeBucket(this.tenantId, this.actorId, bucket)
  }

  async persist(command: SyncCommand): Promise<SyncPersistResult> {
    if (command.tenantId !== this.tenantId || command.actorId !== this.actorId) {
      throw new Error('SYNC_SCOPE_MISMATCH')
    }
    const bucket = this.load()
    const existing = bucket.records[command.commandId]
    const now = new Date().toISOString()
    if (!existing) {
      const record: SyncOutboxRecord = {
        command: structuredClone(command),
        status: 'queued',
        attemptCount: 0,
        lastError: null,
        serverAckId: null,
        appliedAt: null,
        createdAt: now,
        updatedAt: now,
        checkpoint: null,
      }
      bucket.records[command.commandId] = record
      this.save(bucket)
      return { outcome: 'inserted', record: structuredClone(record) }
    }

    const decision = resolveSyncConflict({
      existing: {
        commandId: existing.command.commandId,
        payloadHash: existing.command.payloadHash,
        status: existing.status,
      },
      incoming: { commandId: command.commandId, payloadHash: command.payloadHash },
      commandType: command.commandType,
    })
    if (decision === 'replay') {
      return { outcome: 'replay', record: structuredClone(existing) }
    }
    existing.status = 'conflict'
    existing.lastError = decision.reason
    existing.updatedAt = now
    bucket.records[command.commandId] = existing
    this.save(bucket)
    return { outcome: 'conflict', record: structuredClone(existing), conflict: decision }
  }

  async get(commandId: string): Promise<SyncOutboxRecord | null> {
    const row = this.load().records[commandId]
    return row ? structuredClone(row) : null
  }

  async listReady(tenantId: string, limit: number): Promise<SyncOutboxRecord[]> {
    if (tenantId !== this.tenantId) return []
    const ready: SyncOutboxStatus[] = ['queued', 'syncing', 'applied']
    return Object.values(this.load().records)
      .filter((row) => ready.includes(row.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map((row) => structuredClone(row))
  }

  async markSyncing(commandId: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'syncing'
    row.attemptCount += 1
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async markQueued(commandId: string, error: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'queued'
    row.lastError = error
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async markApplied(
    commandId: string,
    result: Extract<SyncApplyResult, { outcome: 'applied' | 'replay' }>,
  ): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'applied'
    row.serverAckId = result.serverAckId
    row.appliedAt = new Date().toISOString()
    row.checkpoint = result.checkpoint
    row.response = result.response
    row.lastError = null
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async acknowledge(
    commandId: string,
    tenantId: string,
    result: Extract<SyncApplyResult, { outcome: 'applied' | 'replay' }>,
  ): Promise<void> {
    if (tenantId !== this.tenantId) return
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'acknowledged'
    row.serverAckId = result.serverAckId
    row.checkpoint = result.checkpoint
    row.response = result.response
    row.updatedAt = new Date().toISOString()
    bucket.checkpoints[tenantId] = result.checkpoint
    this.save(bucket)
  }

  async markConflict(commandId: string, conflict: SyncConflict, error?: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'conflict'
    row.lastError = error ?? conflict.reason
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async markRejected(commandId: string, reason: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row) return
    row.status = 'rejected'
    row.lastError = reason
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async getCheckpoint(tenantId: string): Promise<string | null> {
    return this.load().checkpoints[tenantId] ?? null
  }

  listPendingSummary(): { pending: number; conflicts: number; rejected: number; failed: number } {
    const rows = Object.values(this.load().records)
    let pending = 0
    let conflicts = 0
    let rejected = 0
    for (const row of rows) {
      if (row.status === 'conflict') conflicts += 1
      else if (row.status === 'rejected') rejected += 1
      else if (row.status !== 'acknowledged') pending += 1
    }
    return { pending, conflicts, rejected, failed: rejected + conflicts }
  }
}
