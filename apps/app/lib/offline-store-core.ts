import {
  resolveSyncConflict,
  type SyncCommand,
  type SyncConflict,
  type SyncOutboxStatus,
} from '../../../packages/db/src/sync-contract'
import type {
  SyncApplyResult,
  SyncOutboxRecord,
  SyncOutboxStore,
  SyncPersistResult,
} from '../../../packages/db/src/sync-runtime'

export type SQLiteValue = string | number | null | Uint8Array

export interface SyncSQLiteConnection {
  execAsync(source: string): Promise<void>
  runAsync(source: string, params: SQLiteValue[]): Promise<unknown>
  getFirstAsync<T>(source: string, params?: SQLiteValue[]): Promise<T | null>
  getAllAsync<T>(source: string, params?: SQLiteValue[]): Promise<T[]>
  withTransactionAsync(task: () => Promise<void>): Promise<void>
  withExclusiveTransactionAsync?(
    task: (transaction: SyncSQLiteConnection) => Promise<void>,
  ): Promise<void>
}

type OutboxRow = {
  command_id: string
  tenant_id: string
  payload_hash: string
  command_json: string
  status: SyncOutboxStatus
  attempt_count: number
  last_error: string | null
  server_ack_id: string | null
  applied_at: string | null
  checkpoint: string | null
  response_json: string | null
  created_at: string
  updated_at: string
}

export type OfflineSyncStatus = {
  pending: number
  rejected: number
  conflicts: number
}

const READY_STATUSES = "'queued','syncing','applied'"
const ACK_RESULT =
  {} as Extract<SyncApplyResult, { outcome: 'applied' | 'replay' }>

function rowToRecord(row: OutboxRow): SyncOutboxRecord {
  return {
    command: JSON.parse(row.command_json) as SyncCommand,
    status: row.status,
    attemptCount: Number(row.attempt_count),
    lastError: row.last_error,
    serverAckId: row.server_ack_id,
    appliedAt: row.applied_at,
    checkpoint: row.checkpoint,
    response: row.response_json ? (JSON.parse(row.response_json) as unknown) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * SQLite implementation shared by Expo and the Node durability tests.
 * `synchronous=FULL` makes a resolved commit mean SQLite has flushed its WAL record.
 */
export class SQLiteSyncOutboxStore implements SyncOutboxStore {
  private initialization: Promise<void> | null = null

  constructor(private readonly database: SyncSQLiteConnection) {}

  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        CREATE TABLE IF NOT EXISTS synapse_sync_outbox (
          command_id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          command_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK (
            status IN ('queued','syncing','applied','acknowledged','conflict','rejected')
          ),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          server_ack_id TEXT,
          applied_at TEXT,
          checkpoint TEXT,
          response_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS synapse_sync_outbox_tenant_status_idx
          ON synapse_sync_outbox (tenant_id, status, created_at);
        CREATE TABLE IF NOT EXISTS synapse_sync_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
    }
    return this.initialization
  }

  async persist(command: SyncCommand): Promise<SyncPersistResult> {
    await this.initialize()
    return this.transaction(async (transaction) => {
      const existing = await transaction.getFirstAsync<OutboxRow>(
        'SELECT * FROM synapse_sync_outbox WHERE command_id = ?',
        [command.commandId],
      )

      if (existing) {
        const existingRecord = rowToRecord(existing)
        const resolution = resolveSyncConflict({
          existing: {
            commandId: existing.command_id,
            payloadHash: existing.payload_hash,
            status: existing.status,
          },
          incoming: { commandId: command.commandId, payloadHash: command.payloadHash },
          commandType: command.commandType,
        })

        if (existing.tenant_id !== command.tenantId || resolution !== 'replay') {
          const conflict: SyncConflict =
            resolution === 'replay'
              ? { policy: 'human_review', reason: 'idempotency_mismatch' }
              : resolution
          if (existing.tenant_id === command.tenantId) {
            const updatedAt = new Date().toISOString()
            await transaction.runAsync(
              `UPDATE synapse_sync_outbox
               SET status = 'conflict', last_error = ?, updated_at = ?
               WHERE command_id = ?`,
              [conflict.reason, updatedAt, command.commandId],
            )
            existingRecord.status = 'conflict'
            existingRecord.lastError = conflict.reason
            existingRecord.updatedAt = updatedAt
          }
          return { outcome: 'conflict', record: existingRecord, conflict }
        }

        return { outcome: 'replay', record: existingRecord }
      }

      const now = new Date().toISOString()
      await transaction.runAsync(
        `INSERT INTO synapse_sync_outbox (
          command_id, tenant_id, payload_hash, command_json, status,
          attempt_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)`,
        [
          command.commandId,
          command.tenantId,
          command.payloadHash,
          JSON.stringify(command),
          now,
          now,
        ],
      )
      return {
        outcome: 'inserted',
        record: {
          command,
          status: 'queued',
          attemptCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      }
    })
  }

  async get(commandId: string): Promise<SyncOutboxRecord | null> {
    await this.initialize()
    const row = await this.database.getFirstAsync<OutboxRow>(
      'SELECT * FROM synapse_sync_outbox WHERE command_id = ?',
      [commandId],
    )
    return row ? rowToRecord(row) : null
  }

  async listReady(tenantId: string, limit: number): Promise<SyncOutboxRecord[]> {
    await this.initialize()
    const rows = await this.database.getAllAsync<OutboxRow>(
      `SELECT * FROM synapse_sync_outbox
       WHERE tenant_id = ? AND status IN (${READY_STATUSES})
       ORDER BY created_at ASC
       LIMIT ?`,
      [tenantId, limit],
    )
    return rows.map(rowToRecord)
  }

  async markSyncing(commandId: string): Promise<void> {
    await this.update(
      `status = 'syncing', attempt_count = attempt_count + 1, last_error = NULL`,
      commandId,
    )
  }

  async markQueued(commandId: string, error: string): Promise<void> {
    await this.update(`status = 'queued', last_error = ?`, commandId, [error])
  }

  async markApplied(
    commandId: string,
    result: typeof ACK_RESULT,
  ): Promise<void> {
    await this.update(
      `status = 'applied', last_error = NULL, server_ack_id = ?,
       applied_at = ?, checkpoint = ?, response_json = ?`,
      commandId,
      [
        result.serverAckId,
        result.checkpoint,
        result.checkpoint,
        result.response === undefined ? null : JSON.stringify(result.response),
      ],
    )
  }

  async acknowledge(
    commandId: string,
    tenantId: string,
    result: typeof ACK_RESULT,
  ): Promise<void> {
    await this.initialize()
    await this.transaction(async (transaction) => {
      const now = new Date().toISOString()
      await transaction.runAsync(
        `UPDATE synapse_sync_outbox
         SET status = 'acknowledged', last_error = NULL, updated_at = ?
         WHERE command_id = ?`,
        [now, commandId],
      )
      await transaction.runAsync(
        `INSERT INTO synapse_sync_metadata (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [`checkpoint:${tenantId}`, result.checkpoint, now],
      )
    })
  }

  async markConflict(
    commandId: string,
    conflict: SyncConflict,
    error?: string,
  ): Promise<void> {
    await this.update(`status = 'conflict', last_error = ?`, commandId, [
      error ?? conflict.reason,
    ])
  }

  async markRejected(commandId: string, reason: string): Promise<void> {
    await this.update(`status = 'rejected', last_error = ?`, commandId, [reason])
  }

  async getCheckpoint(tenantId: string): Promise<string | null> {
    await this.initialize()
    const row = await this.database.getFirstAsync<{ value: string }>(
      'SELECT value FROM synapse_sync_metadata WHERE key = ?',
      [`checkpoint:${tenantId}`],
    )
    return row?.value ?? null
  }

  async status(tenantId: string): Promise<OfflineSyncStatus> {
    await this.initialize()
    const rows = await this.database.getAllAsync<{ status: SyncOutboxStatus; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM synapse_sync_outbox
       WHERE tenant_id = ? AND status != 'acknowledged'
       GROUP BY status`,
      [tenantId],
    )
    const result: OfflineSyncStatus = { pending: 0, rejected: 0, conflicts: 0 }
    for (const row of rows) {
      if (row.status === 'rejected') result.rejected += Number(row.count)
      else if (row.status === 'conflict') result.conflicts += Number(row.count)
      else result.pending += Number(row.count)
    }
    return result
  }

  private async update(
    assignments: string,
    commandId: string,
    values: SQLiteValue[] = [],
  ): Promise<void> {
    await this.initialize()
    await this.database.runAsync(
      `UPDATE synapse_sync_outbox SET ${assignments}, updated_at = ? WHERE command_id = ?`,
      [...values, new Date().toISOString(), commandId],
    )
  }

  private async transaction<T>(
    task: (transaction: SyncSQLiteConnection) => Promise<T>,
  ): Promise<T> {
    let result: T | undefined
    if (this.database.withExclusiveTransactionAsync) {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        result = await task(transaction)
      })
    } else {
      await this.database.withTransactionAsync(async () => {
        result = await task(this.database)
      })
    }
    return result as T
  }
}
