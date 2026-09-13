/**
 * In-memory SyncOutboxStore for unit tests and browser adapters that mirror
 * the same semantics. Not durable across process restarts — use a persistent
 * store (SQLite / localStorage adapter) for real offline recovery.
 */

import {
  resolveSyncConflict,
  type SyncCommand,
  type SyncConflict,
  type SyncOutboxStatus,
} from "./sync-contract"
import type {
  SyncApplyResult,
  SyncOutboxRecord,
  SyncOutboxStore,
  SyncPersistResult,
} from "./sync-runtime"

type InternalRecord = SyncOutboxRecord & {
  attemptCount: number
  lastError: string | null
}

function cloneRecord(record: InternalRecord): SyncOutboxRecord {
  return {
    command: structuredClone(record.command),
    status: record.status,
    attemptCount: record.attemptCount,
    lastError: record.lastError,
    serverAckId: record.serverAckId ?? null,
    appliedAt: record.appliedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    checkpoint: record.checkpoint ?? null,
    response: record.response,
  }
}

export class MemorySyncOutboxStore implements SyncOutboxStore {
  private readonly records = new Map<string, InternalRecord>()
  private readonly checkpoints = new Map<string, string>()

  async initialize(): Promise<void> {
    // no-op
  }

  async persist(command: SyncCommand): Promise<SyncPersistResult> {
    const existing = this.records.get(command.commandId)
    const now = new Date().toISOString()
    if (!existing) {
      const record: InternalRecord = {
        command: structuredClone(command),
        status: "queued",
        attemptCount: 0,
        lastError: null,
        serverAckId: null,
        appliedAt: null,
        createdAt: now,
        updatedAt: now,
        checkpoint: null,
        response: undefined,
      }
      this.records.set(command.commandId, record)
      return { outcome: "inserted", record: cloneRecord(record) }
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

    if (decision === "replay") {
      return { outcome: "replay", record: cloneRecord(existing) }
    }

    existing.status = "conflict"
    existing.lastError = decision.reason
    existing.updatedAt = now
    return {
      outcome: "conflict",
      record: cloneRecord(existing),
      conflict: decision,
    }
  }

  async get(commandId: string): Promise<SyncOutboxRecord | null> {
    const record = this.records.get(commandId)
    return record ? cloneRecord(record) : null
  }

  async listReady(tenantId: string, limit: number): Promise<SyncOutboxRecord[]> {
    return [...this.records.values()]
      .filter((row) => row.command.tenantId === tenantId && (row.status === "queued" || row.status === "syncing" || row.status === "applied"))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map(cloneRecord)
  }

  async markSyncing(commandId: string): Promise<void> {
    const record = this.records.get(commandId)
    if (!record) return
    record.status = "syncing"
    record.attemptCount += 1
    record.updatedAt = new Date().toISOString()
  }

  async markQueued(commandId: string, error: string): Promise<void> {
    const record = this.records.get(commandId)
    if (!record) return
    record.status = "queued"
    record.lastError = error
    record.updatedAt = new Date().toISOString()
  }

  async markApplied(
    commandId: string,
    result: Extract<SyncApplyResult, { outcome: "applied" | "replay" }>,
  ): Promise<void> {
    const record = this.records.get(commandId)
    if (!record) return
    record.status = "applied"
    record.serverAckId = result.serverAckId
    record.appliedAt = new Date().toISOString()
    record.checkpoint = result.checkpoint
    record.response = result.response
    record.lastError = null
    record.updatedAt = new Date().toISOString()
  }

  async acknowledge(
    commandId: string,
    tenantId: string,
    result: Extract<SyncApplyResult, { outcome: "applied" | "replay" }>,
  ): Promise<void> {
    const record = this.records.get(commandId)
    if (!record || record.command.tenantId !== tenantId) return
    record.status = "acknowledged"
    record.serverAckId = result.serverAckId
    record.checkpoint = result.checkpoint
    record.response = result.response
    record.updatedAt = new Date().toISOString()
    this.checkpoints.set(tenantId, result.checkpoint)
  }

  async markConflict(commandId: string, conflict: SyncConflict, error?: string): Promise<void> {
    const record = this.records.get(commandId)
    if (!record) return
    record.status = "conflict"
    record.lastError = error ?? conflict.reason
    record.updatedAt = new Date().toISOString()
  }

  async markRejected(commandId: string, reason: string): Promise<void> {
    const record = this.records.get(commandId)
    if (!record) return
    record.status = "rejected"
    record.lastError = reason
    record.updatedAt = new Date().toISOString()
  }

  async getCheckpoint(tenantId: string): Promise<string | null> {
    return this.checkpoints.get(tenantId) ?? null
  }

  /** Test helper — snapshot statuses for assertions. */
  dump(): Array<{ commandId: string; status: SyncOutboxStatus; lastError: string | null }> {
    return [...this.records.values()].map((row) => ({
      commandId: row.command.commandId,
      status: row.status,
      lastError: row.lastError,
    }))
  }

  clearForActor(actorId: string): void {
    for (const [id, row] of this.records) {
      if (row.command.actorId === actorId) this.records.delete(id)
    }
  }
}
