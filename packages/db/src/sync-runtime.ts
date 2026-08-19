import {
  assertSyncCommand,
  hashPayload,
  type SyncCommand,
  type SyncConflict,
  type SyncEnvelope,
  type SyncOutboxStatus,
} from "./sync-contract"

export type SyncOutboxRecord = SyncEnvelope & {
  createdAt: string
  updatedAt: string
  checkpoint?: string | null
  response?: unknown
}

export type SyncPersistResult =
  | { outcome: "inserted" | "replay"; record: SyncOutboxRecord }
  | { outcome: "conflict"; record: SyncOutboxRecord; conflict: SyncConflict }

export type SyncApplyResult =
  | {
      outcome: "applied" | "replay"
      serverAckId: string
      checkpoint: string
      response?: unknown
    }
  | { outcome: "conflict"; conflict: SyncConflict; error?: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "retry"; error: string }

export type SyncFlushItem = {
  commandId: string
  outcome: SyncApplyResult["outcome"]
  response?: unknown
  error?: string
}

export type SyncFlushSummary = {
  processed: number
  acknowledged: number
  replayed: number
  rejected: number
  conflicts: number
  retrying: number
  items: SyncFlushItem[]
}

export interface SyncOutboxStore {
  initialize(): Promise<void>
  persist(command: SyncCommand): Promise<SyncPersistResult>
  get(commandId: string): Promise<SyncOutboxRecord | null>
  listReady(tenantId: string, limit: number): Promise<SyncOutboxRecord[]>
  markSyncing(commandId: string): Promise<void>
  markQueued(commandId: string, error: string): Promise<void>
  markApplied(
    commandId: string,
    result: Extract<SyncApplyResult, { outcome: "applied" | "replay" }>,
  ): Promise<void>
  acknowledge(
    commandId: string,
    tenantId: string,
    result: Extract<SyncApplyResult, { outcome: "applied" | "replay" }>,
  ): Promise<void>
  markConflict(commandId: string, conflict: SyncConflict, error?: string): Promise<void>
  markRejected(commandId: string, reason: string): Promise<void>
  getCheckpoint(tenantId: string): Promise<string | null>
}

export class SyncPayloadConflictError extends Error {
  readonly conflict: SyncConflict

  constructor(conflict: SyncConflict) {
    super("SYNC_PAYLOAD_CONFLICT")
    this.name = "SyncPayloadConflictError"
    this.conflict = conflict
  }
}

export class SyncCommandStateError extends Error {
  readonly status: SyncOutboxStatus

  constructor(status: SyncOutboxStatus) {
    super(`SYNC_COMMAND_${status.toUpperCase()}`)
    this.name = "SyncCommandStateError"
    this.status = status
  }
}

type PayloadHasher = (payload: Record<string, unknown>) => Promise<string>

/**
 * Durable command orchestrator. The store owns the atomic local transaction;
 * this runtime owns validation, tenant scoping, retries, and acknowledgement.
 */
export class SyncRuntime {
  private initialized = false

  constructor(
    private readonly tenantId: string,
    private readonly store: SyncOutboxStore,
    private readonly payloadHasher: PayloadHasher = hashPayload,
  ) {}

  private async initialize(): Promise<void> {
    if (this.initialized) return
    await this.store.initialize()
    this.initialized = true
  }

  async commit(command: SyncCommand): Promise<SyncOutboxRecord> {
    await this.initialize()
    assertSyncCommand(command)
    if (command.tenantId !== this.tenantId) throw new Error("SYNC_TENANT_MISMATCH")

    const computedHash = await this.payloadHasher(command.payload)
    if (computedHash !== command.payloadHash) throw new Error("SYNC_PAYLOAD_HASH_INVALID")

    const persisted = await this.store.persist(command)
    if (persisted.outcome === "conflict") {
      throw new SyncPayloadConflictError(persisted.conflict)
    }
    if (persisted.record.status === "conflict" || persisted.record.status === "rejected") {
      throw new SyncCommandStateError(persisted.record.status)
    }
    return persisted.record
  }

  async flush(
    apply: (command: SyncCommand) => Promise<SyncApplyResult>,
    limit = 20,
  ): Promise<SyncFlushSummary> {
    await this.initialize()
    const records = await this.store.listReady(this.tenantId, limit)
    const summary: SyncFlushSummary = {
      processed: 0,
      acknowledged: 0,
      replayed: 0,
      rejected: 0,
      conflicts: 0,
      retrying: 0,
      items: [],
    }

    for (const record of records) {
      summary.processed += 1
      await this.store.markSyncing(record.command.commandId)

      let result: SyncApplyResult
      try {
        result = await apply(record.command)
      } catch (error) {
        result = {
          outcome: "retry",
          error: error instanceof Error ? error.message : "SYNC_APPLY_FAILED",
        }
      }

      if (result.outcome === "applied" || result.outcome === "replay") {
        await this.store.markApplied(record.command.commandId, result)
        // Checkpoint and local acknowledgement are committed together by the store.
        await this.store.acknowledge(record.command.commandId, this.tenantId, result)
        summary.acknowledged += 1
        if (result.outcome === "replay") summary.replayed += 1
        summary.items.push({
          commandId: record.command.commandId,
          outcome: result.outcome,
          response: result.response,
        })
        continue
      }

      if (result.outcome === "conflict") {
        await this.store.markConflict(record.command.commandId, result.conflict, result.error)
        summary.conflicts += 1
        summary.items.push({
          commandId: record.command.commandId,
          outcome: result.outcome,
          error: result.error ?? result.conflict.reason,
        })
        continue
      }

      if (result.outcome === "rejected") {
        await this.store.markRejected(record.command.commandId, result.reason)
        summary.rejected += 1
        summary.items.push({
          commandId: record.command.commandId,
          outcome: result.outcome,
          error: result.reason,
        })
        continue
      }

      await this.store.markQueued(record.command.commandId, result.error)
      summary.retrying += 1
      summary.items.push({
        commandId: record.command.commandId,
        outcome: result.outcome,
        error: result.error,
      })
    }

    return summary
  }

  async checkpoint(): Promise<string | null> {
    await this.initialize()
    return this.store.getCheckpoint(this.tenantId)
  }
}
