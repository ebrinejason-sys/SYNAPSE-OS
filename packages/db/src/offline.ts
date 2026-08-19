/**
 * Offline / edge mutation envelope. Pharmacy and satellites should reuse this
 * instead of inventing a second source of truth.
 *
 * Web POS currently refuses durable offline writes (see apps/pharmacy/lib/offlineStorage.ts).
 * This module defines the contract the outbox table and Expo queue must share.
 */

export const OFFLINE_MUTATION_TYPES = [
  "pharmacy.sale",
  "pharmacy.receive",
  "pharmacy.adjust",
  "pharmacy.transfer",
  "identity.register",
] as const

export type OfflineMutationType = (typeof OFFLINE_MUTATION_TYPES)[number]

export type OfflineMutationEnvelope = {
  tenantId: string
  siteId?: string | null
  actorId?: string | null
  mutationType: OfflineMutationType | string
  idempotencyKey: string
  payload: Record<string, unknown>
  clientDeviceId?: string | null
  createdAt?: string
}

export type OfflineConflict = {
  reason: "idempotency_mismatch" | "stale_version" | "insufficient_stock" | "unknown"
  serverState?: Record<string, unknown>
}

export function isReplaySafe(existingKey: string, incomingKey: string): boolean {
  return existingKey === incomingKey && existingKey.length > 0
}

/**
 * Legacy row mapper. New code should build a SyncCommand and call toSyncOutboxRow.
 * The outbox idempotency_key is the command ID.
 */
export function toOutboxInsert(envelope: OfflineMutationEnvelope): Record<string, unknown> {
  if (!envelope.idempotencyKey?.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED")
  if (!envelope.tenantId) throw new Error("TENANT_REQUIRED")
  return {
    tenant_id: envelope.tenantId,
    site_id: envelope.siteId ?? null,
    actor_id: envelope.actorId ?? null,
    mutation_type: envelope.mutationType,
    idempotency_key: envelope.idempotencyKey,
    payload: envelope.payload,
    client_device_id: envelope.clientDeviceId ?? null,
    status: "queued",
  }
}
