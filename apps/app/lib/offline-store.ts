import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as SQLite from 'expo-sqlite'
import {
  SYNC_SCHEMA_VERSION,
  assertSyncCommand,
  canonicalizePayload,
  isUuid,
  type SyncCommand,
  type SyncConflict,
} from '../../../packages/db/src/sync-contract'
import {
  SyncPayloadConflictError,
  SyncRuntime,
  type SyncApplyResult,
  type SyncFlushSummary,
} from '../../../packages/db/src/sync-runtime'
import { apiRequest, ApiError } from './api'
import {
  decodeKey,
  encodeKey,
  decryptUtf8,
  encryptUtf8,
  generateOfflineKeyBytes,
} from '../../../packages/db/src/offline-crypto'
import {
  OFFLINE_STOCK_MAX_AGE_MS,
  OfflineStockError,
  SQLiteSyncOutboxStore,
  type CatalogueProduct,
  type OfflineOutboxListItem,
  type OfflineSyncStatus,
  type SaleStockLine,
  type SyncSQLiteConnection,
} from './offline-store-core'

const DATABASE_NAME = 'synapse-sync-v1.db'
const DEVICE_ID_KEY = 'synapse_sync_device_id_v1'
const OFFLINE_AES_KEY = 'synapse_offline_aes_v1'

export { OFFLINE_STOCK_MAX_AGE_MS, OfflineStockError }
export type { CatalogueProduct, OfflineOutboxListItem, OfflineSyncStatus }

export type PharmacySalePayload = {
  paymentMethod: string
  paymentStatus: 'captured' | 'offline_unverified'
  taxAmount: number
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    discountAmount: number
    discountReason?: string
    batchId: string | null
  }>
}

type CommitSaleParams = {
  tenantId: string
  actorId: string
  payload: PharmacySalePayload
  commandId?: string
  now?: Date
}

type ServerApplyResponse = {
  outcome: 'applied' | 'replay'
  commandId: string
  serverAckId: string
  checkpoint: string
  result?: unknown
}

let storePromise: Promise<SQLiteSyncOutboxStore> | null = null
const activeTenantSyncs = new Map<string, Promise<SyncFlushSummary>>()

async function getOrCreateOfflineAesKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(OFFLINE_AES_KEY)
  if (existing) return decodeKey(existing)
  const created = await generateOfflineKeyBytes()
  await SecureStore.setItemAsync(OFFLINE_AES_KEY, encodeKey(created))
  return created
}

async function getStore(): Promise<SQLiteSyncOutboxStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const [database, keyBytes] = await Promise.all([
        SQLite.openDatabaseAsync(DATABASE_NAME),
        getOrCreateOfflineAesKey(),
      ])
      const store = new SQLiteSyncOutboxStore(
        database as unknown as SyncSQLiteConnection,
        {
          encode: (json) => encryptUtf8(json, keyBytes),
          decode: (stored) => decryptUtf8(stored, keyBytes),
        },
      )
      await store.initialize()
      return store
    })()
  }
  return storePromise
}

async function expoPayloadHash(payload: Record<string, unknown>): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalizePayload(payload),
    { encoding: Crypto.CryptoEncoding.HEX },
  )
}

async function getSyncDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (existing && isUuid(existing)) return existing
  const created = Crypto.randomUUID()
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created)
  return created
}

export function newPharmacyCommandId(): string {
  return Crypto.randomUUID()
}

export async function cachePharmacyCatalogue(
  tenantId: string,
  products: CatalogueProduct[],
): Promise<void> {
  await (await getStore()).replaceCatalogue(tenantId, products)
}

export async function loadCachedPharmacyCatalogue(
  tenantId: string,
): Promise<{ products: CatalogueProduct[]; capturedAt: string; stale: boolean } | null> {
  return (await getStore()).getCatalogue(tenantId)
}

export async function getPharmacySellableMap(tenantId: string): Promise<Map<string, number>> {
  return (await getStore()).getSellableMap(tenantId)
}

export async function commitPharmacySale(
  params: CommitSaleParams,
): Promise<SyncCommand> {
  const commandId = params.commandId && isUuid(params.commandId)
    ? params.commandId
    : Crypto.randomUUID()
  const payload = params.payload as unknown as Record<string, unknown>
  const command: SyncCommand = {
    commandId,
    commandType: 'pharmacy.sale.complete.v1',
    schemaVersion: SYNC_SCHEMA_VERSION,
    tenantId: params.tenantId,
    facilityId: params.tenantId,
    deviceId: await getSyncDeviceId(),
    actorId: params.actorId,
    aggregateType: 'pharmacy_sale',
    aggregateId: commandId,
    capturedAtClient: new Date().toISOString(),
    payload,
    payloadHash: await expoPayloadHash(payload),
  }
  assertSyncCommand(command)

  const lines: SaleStockLine[] = params.payload.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    batchId: item.batchId,
  }))
  const store = await getStore()
  const persisted = await store.persistSale(command, lines, { now: params.now })
  if (persisted.outcome === 'conflict') {
    throw new SyncPayloadConflictError(persisted.conflict)
  }
  return command
}

export async function syncPharmacySales(
  tenantId: string,
  token: string,
): Promise<SyncFlushSummary> {
  const store = await getStore()
  for (;;) {
    const active = activeTenantSyncs.get(tenantId)
    if (!active) break
    await active.catch(() => undefined)
  }

  const runtime = new SyncRuntime(tenantId, store, expoPayloadHash)
  const pending = runtime.flush((command) => applyCommand(command, token))
  const guarded = pending.finally(() => {
    if (activeTenantSyncs.get(tenantId) === guarded) {
      activeTenantSyncs.delete(tenantId)
    }
  })
  activeTenantSyncs.set(tenantId, guarded)
  return guarded
}

export async function getPharmacySyncStatus(
  tenantId: string,
): Promise<OfflineSyncStatus> {
  return (await getStore()).status(tenantId)
}

export async function listPharmacySyncCommands(
  tenantId: string,
): Promise<OfflineOutboxListItem[]> {
  return (await getStore()).listCommands(tenantId)
}

async function applyCommand(
  command: SyncCommand,
  token: string,
): Promise<SyncApplyResult> {
  try {
    const response = await apiRequest<ServerApplyResponse>(
      '/api/mobile/pharmacy/sync/apply',
      {
        method: 'POST',
        token,
        body: { command },
      },
    )
    return {
      outcome: response.outcome,
      serverAckId: response.serverAckId,
      checkpoint: response.checkpoint,
      response: response.result,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      const outcome = error.payload.outcome
      if (outcome === 'conflict') {
        const conflict = error.payload.conflict as SyncConflict | undefined
        return {
          outcome: 'conflict',
          conflict: conflict ?? {
            policy: 'human_review',
            reason: 'idempotency_mismatch',
          },
          error: error.message,
        }
      }
      if (outcome === 'rejected') {
        return {
          outcome: 'rejected',
          reason:
            typeof error.payload.reason === 'string'
              ? error.payload.reason
              : error.message,
        }
      }
    }
    return {
      outcome: 'retry',
      error: error instanceof Error ? error.message : 'SYNC_APPLY_FAILED',
    }
  }
}
