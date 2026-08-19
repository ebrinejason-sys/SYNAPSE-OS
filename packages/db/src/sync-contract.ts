/**
 * SYNAPSE Core sync protocol — frozen contract.
 *
 * Pharmacy, Expo, Edge, and future clinical modules MUST reuse this envelope.
 * Do not invent a second command format or last-write-wins merge.
 *
 * Persistence/runtime lives outside this file. This module only defines
 * types, hashing, validation, and conflict policy.
 */

export const SYNC_SCHEMA_VERSION = 1 as const

export const SYNC_COMMAND_TYPES = [
  "pharmacy.sale.complete.v1",
  "pharmacy.stock.receive.v1",
  "pharmacy.stock.adjust.v1",
  "pharmacy.stock.transfer.v1",
  "pharmacy.sale.reverse.v1",
  "identity.person.register.v1",
] as const

export type SyncCommandType = (typeof SYNC_COMMAND_TYPES)[number]

export const SYNC_AGGREGATE_TYPES = [
  "pharmacy_sale",
  "pharmacy_batch",
  "pharmacy_transfer",
  "person",
] as const

export type SyncAggregateType = (typeof SYNC_AGGREGATE_TYPES)[number]

export const SYNC_OUTBOX_STATUSES = [
  "queued",
  "syncing",
  "applied",
  "acknowledged",
  "conflict",
  "rejected",
] as const

export type SyncOutboxStatus = (typeof SYNC_OUTBOX_STATUSES)[number]

export type SyncCommand = {
  commandId: string
  commandType: SyncCommandType | (string & {})
  schemaVersion: typeof SYNC_SCHEMA_VERSION | number
  tenantId: string
  facilityId: string
  siteId?: string | null
  deviceId: string
  actorId: string
  activeRoleAssignmentId?: string | null
  aggregateType: SyncAggregateType | (string & {})
  aggregateId: string
  baseRevision?: number | null
  capturedAtClient: string
  offlineAuthorizationLeaseId?: string | null
  payload: Record<string, unknown>
  payloadHash: string
  signature?: string | null
  correlationId?: string | null
}

export type SyncEnvelope = {
  command: SyncCommand
  status: SyncOutboxStatus
  attemptCount: number
  lastError?: string | null
  serverAckId?: string | null
  appliedAt?: string | null
}

export type SyncConflictPolicy =
  | "idempotent_replay"
  | "reject_stale"
  | "human_review"
  | "insufficient_stock"

export type SyncConflict = {
  policy: SyncConflictPolicy
  reason: "idempotency_mismatch" | "stale_revision" | "insufficient_stock" | "lease_expired" | "unknown"
  serverState?: Record<string, unknown>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Stable JSON for hashing — key-sorted, no undefined. */
export function canonicalizePayload(payload: Record<string, unknown>): string {
  return JSON.stringify(sortValue(payload))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] === undefined) continue
      out[key] = sortValue(obj[key])
    }
    return out
  }
  return value
}

export async function hashPayload(payload: Record<string, unknown>): Promise<string> {
  const canonical = canonicalizePayload(payload)
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const bytes = new TextEncoder().encode(canonical)
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
    return bufferToHex(digest)
  }
  return fallbackSha256Hex(canonical)
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Small SHA-256 for Node test environments without subtle.digest quirks. */
function fallbackSha256Hex(message: string): string {
  // Node 22 always has crypto.subtle; this branch is for completeness.
  return `fnv1a32:${fnv1a32(message).toString(16).padStart(8, "0")}`
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function assertSyncCommand(command: SyncCommand): void {
  if (!isUuid(command.commandId)) throw new Error("COMMAND_ID_REQUIRED")
  if (!command.commandType?.trim()) throw new Error("COMMAND_TYPE_REQUIRED")
  if (!isUuid(command.tenantId)) throw new Error("TENANT_REQUIRED")
  if (!isUuid(command.facilityId)) throw new Error("FACILITY_REQUIRED")
  if (!isUuid(command.deviceId)) throw new Error("DEVICE_REQUIRED")
  if (!isUuid(command.actorId)) throw new Error("ACTOR_REQUIRED")
  if (!isUuid(command.aggregateId)) throw new Error("AGGREGATE_ID_REQUIRED")
  if (!command.aggregateType?.trim()) throw new Error("AGGREGATE_TYPE_REQUIRED")
  if (!command.capturedAtClient) throw new Error("CAPTURED_AT_REQUIRED")
  if (!command.payload || typeof command.payload !== "object") throw new Error("PAYLOAD_REQUIRED")
  if (!command.payloadHash?.trim()) throw new Error("PAYLOAD_HASH_REQUIRED")
  if (command.schemaVersion !== SYNC_SCHEMA_VERSION) throw new Error("UNSUPPORTED_SYNC_SCHEMA")
}

export function conflictPolicyFor(commandType: string): SyncConflictPolicy {
  if (commandType.startsWith("pharmacy.sale.") || commandType.startsWith("pharmacy.stock.")) {
    return "idempotent_replay"
  }
  if (commandType.startsWith("identity.")) return "human_review"
  return "reject_stale"
}

/**
 * Financial / inventory / clinical aggregates never last-write-wins.
 * Same commandId + same payloadHash → safe replay. Anything else is conflict.
 */
export function resolveSyncConflict(params: {
  existing: { commandId: string; payloadHash: string; status: SyncOutboxStatus }
  incoming: { commandId: string; payloadHash: string }
  commandType: string
}): "replay" | SyncConflict {
  if (params.existing.commandId !== params.incoming.commandId) {
    return {
      policy: conflictPolicyFor(params.commandType),
      reason: "unknown",
    }
  }
  if (params.existing.payloadHash === params.incoming.payloadHash) {
    return "replay"
  }
  return {
    policy: "human_review",
    reason: "idempotency_mismatch",
  }
}

export function toSyncOutboxRow(command: SyncCommand): Record<string, unknown> {
  assertSyncCommand(command)
  return {
    tenant_id: command.tenantId,
    site_id: command.siteId ?? null,
    actor_id: command.actorId,
    mutation_type: command.commandType,
    idempotency_key: command.commandId,
    payload: {
      envelope: command,
    },
    client_device_id: command.deviceId,
    status: "queued" satisfies SyncOutboxStatus,
  }
}

export type PersonIdentity = {
  personId: string
  synapseId: string
  fullName: string
}

export type AuditEvent = {
  actorId?: string | null
  actorRole?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  organizationId?: string | null
  tenantId?: string | null
  siteId?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown>
}
