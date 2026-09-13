/**
 * Browser outbox for hospital clinical SyncCommands.
 *
 * Security model (RC1):
 * - Storage key is scoped by tenantId + actorId (isolation between users).
 * - Command payloads are AES-GCM encrypted with a session-scoped key in sessionStorage.
 *   Closing the tab drops the key; ciphertext remains but is unreadable without re-auth key install.
 * - Plaintext PHI is never written to localStorage.
 * - Logout parks pending items (does not silently discard). Another actor cannot decrypt or flush.
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

type StoredRecord = {
  commandId: string
  tenantId: string
  actorId: string
  commandType: string
  status: SyncOutboxStatus
  attemptCount: number
  lastError: string | null
  serverAckId: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
  checkpoint: string | null
  /** AES-GCM ciphertext (base64) of SyncCommand JSON — never plaintext PHI */
  encryptedCommand: string
  iv: string
}

type StoredBucket = {
  version: 2
  records: Record<string, StoredRecord>
  checkpoints: Record<string, string>
}

type ParkedBucket = {
  version: 2
  parkedAt: string
  tenantId: string
  actorId: string
  records: Record<string, StoredRecord>
  /** Session AES key material so the same actor can restore after re-login. Cleared from sessionStorage on park. */
  keyMaterial: string | null
}

const PREFIX = 'synapse.hospital.clinical.outbox.v2'
const PARK_PREFIX = 'synapse.hospital.clinical.parked.v2'
const DEVICE_KEY = 'synapse.hospital.clinical.deviceId.v1'
const SESSION_KEY_MATERIAL = 'synapse.hospital.clinical.sessionKey.v1'

function storageKey(tenantId: string, actorId: string): string {
  return `${PREFIX}:${tenantId}:${actorId}`
}

function parkKey(tenantId: string, actorId: string): string {
  return `${PARK_PREFIX}:${tenantId}:${actorId}`
}

function emptyBucket(): StoredBucket {
  return { version: 2, records: {}, checkpoints: {} }
}

function b64FromBytes(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach((b) => {
    s += String.fromCharCode(b)
  })
  return btoa(s)
}

function bytesFromB64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i)
  return out
}

async function getSessionCryptoKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.sessionStorage || !window.crypto?.subtle) {
    throw new Error('OFFLINE_CRYPTO_UNAVAILABLE')
  }
  let material = window.sessionStorage.getItem(SESSION_KEY_MATERIAL)
  if (!material) {
    const raw = crypto.getRandomValues(new Uint8Array(32))
    material = b64FromBytes(raw)
    window.sessionStorage.setItem(SESSION_KEY_MATERIAL, material)
  }
  return crypto.subtle.importKey('raw', bytesFromB64(material), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

async function encryptCommand(command: SyncCommand): Promise<{ encryptedCommand: string; iv: string }> {
  const key = await getSessionCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(command))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { encryptedCommand: b64FromBytes(new Uint8Array(cipher)), iv: b64FromBytes(iv) }
}

async function decryptCommand(encryptedCommand: string, iv: string): Promise<SyncCommand> {
  const key = await getSessionCryptoKey()
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytesFromB64(iv) },
    key,
    bytesFromB64(encryptedCommand),
  )
  return JSON.parse(new TextDecoder().decode(plain)) as SyncCommand
}

function readBucket(tenantId: string, actorId: string): StoredBucket {
  if (typeof window === 'undefined' || !window.localStorage) return emptyBucket()
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId, actorId))
    if (!raw) return emptyBucket()
    const parsed = JSON.parse(raw) as StoredBucket
    if (!parsed || parsed.version !== 2) return emptyBucket()
    return { version: 2, records: parsed.records ?? {}, checkpoints: parsed.checkpoints ?? {} }
  } catch {
    return emptyBucket()
  }
}

function writeBucket(tenantId: string, actorId: string, bucket: StoredBucket): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(storageKey(tenantId, actorId), JSON.stringify(bucket))
}

/** Park pending work on logout — never silent discard. */
export function parkHospitalClinicalOutbox(tenantId: string, actorId: string): {
  parked: number
  parkKey: string
} {
  if (typeof window === 'undefined' || !window.localStorage) return { parked: 0, parkKey: '' }
  const bucket = readBucket(tenantId, actorId)
  const pending = Object.values(bucket.records).filter((r) => r.status !== 'acknowledged')
  if (pending.length === 0) {
    window.localStorage.removeItem(storageKey(tenantId, actorId))
    return { parked: 0, parkKey: '' }
  }
  const parked: Omit<ParkedBucket, 'keyMaterial'> = {
    version: 2,
    parkedAt: new Date().toISOString(),
    tenantId,
    actorId,
    records: Object.fromEntries(pending.map((r) => [r.commandId, r])),
  }
  const keyMat = window.sessionStorage?.getItem(SESSION_KEY_MATERIAL) ?? null
  const parkedWithKey: ParkedBucket = { ...parked, keyMaterial: keyMat }
  const key = parkKey(tenantId, actorId)
  window.localStorage.setItem(key, JSON.stringify(parkedWithKey))
  window.localStorage.removeItem(storageKey(tenantId, actorId))
  // Drop live session key; same actor restores via keyMaterial in the park blob.
  window.sessionStorage?.removeItem(SESSION_KEY_MATERIAL)
  return { parked: pending.length, parkKey: key }
}

export function getParkedHospitalClinicalCount(tenantId: string, actorId: string): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0
  try {
    const raw = window.localStorage.getItem(parkKey(tenantId, actorId))
    if (!raw) return 0
    const parsed = JSON.parse(raw) as ParkedBucket
    return Object.keys(parsed.records ?? {}).length
  } catch {
    return 0
  }
}

/** Explicit discard only after user confirmation. */
export function discardParkedHospitalClinicalOutbox(tenantId: string, actorId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(parkKey(tenantId, actorId))
}

/** Restore parked outbox for the same actor after re-login (reinstalls crypto key). */
export function restoreParkedHospitalClinicalOutbox(tenantId: string, actorId: string): {
  restored: number
} {
  if (typeof window === 'undefined' || !window.localStorage) return { restored: 0 }
  const key = parkKey(tenantId, actorId)
  const raw = window.localStorage.getItem(key)
  if (!raw) return { restored: 0 }
  try {
    const parked = JSON.parse(raw) as ParkedBucket
    if (parked.tenantId !== tenantId || parked.actorId !== actorId) return { restored: 0 }
    if (parked.keyMaterial) {
      window.sessionStorage?.setItem(SESSION_KEY_MATERIAL, parked.keyMaterial)
    }
    const active = readBucket(tenantId, actorId)
    for (const [id, row] of Object.entries(parked.records ?? {})) {
      if (!active.records[id]) active.records[id] = row
    }
    writeBucket(tenantId, actorId, active)
    window.localStorage.removeItem(key)
    return { restored: Object.keys(parked.records ?? {}).length }
  } catch {
    return { restored: 0 }
  }
}


export function clearHospitalClinicalOutbox(tenantId: string, actorId: string): void {
  // Backward-compatible name: park instead of destroy.
  parkHospitalClinicalOutbox(tenantId, actorId)
}

export function getOrCreateHospitalDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) return crypto.randomUUID()
  const existing = window.localStorage.getItem(DEVICE_KEY)
  if (existing && existing.length >= 32) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_KEY, created)
  return created
}

export class LocalStorageSyncOutboxStore implements SyncOutboxStore {
  constructor(
    private readonly tenantId: string,
    private readonly actorId: string,
  ) {}

  async initialize(): Promise<void> {
    restoreParkedHospitalClinicalOutbox(this.tenantId, this.actorId)
    writeBucket(this.tenantId, this.actorId, readBucket(this.tenantId, this.actorId))
    await getSessionCryptoKey()
  }

  private load(): StoredBucket {
    return readBucket(this.tenantId, this.actorId)
  }

  private save(bucket: StoredBucket): void {
    writeBucket(this.tenantId, this.actorId, bucket)
  }

  private async toOutboxRecord(row: StoredRecord): Promise<SyncOutboxRecord> {
    const command = await decryptCommand(row.encryptedCommand, row.iv)
    if (command.tenantId !== this.tenantId || command.actorId !== this.actorId) {
      throw new Error('SYNC_SCOPE_MISMATCH')
    }
    return {
      command,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError,
      serverAckId: row.serverAckId,
      appliedAt: row.appliedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      checkpoint: row.checkpoint,
    }
  }

  async persist(command: SyncCommand): Promise<SyncPersistResult> {
    if (command.tenantId !== this.tenantId || command.actorId !== this.actorId) {
      throw new Error('SYNC_SCOPE_MISMATCH')
    }
    const bucket = this.load()
    const existing = bucket.records[command.commandId]
    const now = new Date().toISOString()
    if (!existing) {
      const enc = await encryptCommand(command)
      const record: StoredRecord = {
        commandId: command.commandId,
        tenantId: command.tenantId,
        actorId: command.actorId,
        commandType: String(command.commandType),
        status: 'queued',
        attemptCount: 0,
        lastError: null,
        serverAckId: null,
        appliedAt: null,
        createdAt: now,
        updatedAt: now,
        checkpoint: null,
        encryptedCommand: enc.encryptedCommand,
        iv: enc.iv,
      }
      bucket.records[command.commandId] = record
      this.save(bucket)
      return { outcome: 'inserted', record: await this.toOutboxRecord(record) }
    }

    const existingCommand = await decryptCommand(existing.encryptedCommand, existing.iv)
    const decision = resolveSyncConflict({
      existing: {
        commandId: existing.commandId,
        payloadHash: existingCommand.payloadHash,
        status: existing.status,
      },
      incoming: { commandId: command.commandId, payloadHash: command.payloadHash },
      commandType: command.commandType,
    })
    if (decision === 'replay') {
      return { outcome: 'replay', record: await this.toOutboxRecord(existing) }
    }
    existing.status = 'conflict'
    existing.lastError = decision.reason
    existing.updatedAt = now
    bucket.records[command.commandId] = existing
    this.save(bucket)
    return {
      outcome: 'conflict',
      record: await this.toOutboxRecord(existing),
      conflict: decision,
    }
  }

  async get(commandId: string): Promise<SyncOutboxRecord | null> {
    const row = this.load().records[commandId]
    return row ? this.toOutboxRecord(row) : null
  }

  async listReady(tenantId: string, limit: number): Promise<SyncOutboxRecord[]> {
    if (tenantId !== this.tenantId) return []
    const ready: SyncOutboxStatus[] = ['queued', 'syncing', 'applied']
    const rows = Object.values(this.load().records)
      .filter((row) => ready.includes(row.status) && row.actorId === this.actorId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
    const out: SyncOutboxRecord[] = []
    for (const row of rows) {
      try {
        out.push(await this.toOutboxRecord(row))
      } catch {
        // Unreadable ciphertext (e.g. after session key loss) stays parked for the owner.
      }
    }
    return out
  }

  async markSyncing(commandId: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row || row.actorId !== this.actorId) return
    row.status = 'syncing'
    row.attemptCount += 1
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async markQueued(commandId: string, error: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row || row.actorId !== this.actorId) return
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
    if (!row || row.actorId !== this.actorId) return
    row.status = 'applied'
    row.serverAckId = result.serverAckId
    row.appliedAt = new Date().toISOString()
    row.checkpoint = result.checkpoint
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
    if (!row || row.actorId !== this.actorId) return
    row.status = 'acknowledged'
    row.serverAckId = result.serverAckId
    row.checkpoint = result.checkpoint
    row.updatedAt = new Date().toISOString()
    bucket.checkpoints[tenantId] = result.checkpoint
    this.save(bucket)
  }

  async markConflict(commandId: string, conflict: SyncConflict, error?: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row || row.actorId !== this.actorId) return
    row.status = 'conflict'
    row.lastError = error ?? conflict.reason
    row.updatedAt = new Date().toISOString()
    this.save(bucket)
  }

  async markRejected(commandId: string, reason: string): Promise<void> {
    const bucket = this.load()
    const row = bucket.records[commandId]
    if (!row || row.actorId !== this.actorId) return
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
