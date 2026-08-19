import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as SQLite from 'expo-sqlite'
import {
  SYNC_SCHEMA_VERSION,
  canonicalizePayload,
  isUuid,
  type SyncCommand,
  type SyncConflict,
} from '../../../packages/db/src/sync-contract'
import {
  SyncRuntime,
  type SyncApplyResult,
  type SyncFlushSummary,
} from '../../../packages/db/src/sync-runtime'
import { apiRequest, ApiError } from './api'
import {
  SQLiteSyncOutboxStore,
  type OfflineSyncStatus,
  type SyncSQLiteConnection,
} from './offline-store-core'

const DATABASE_NAME = 'synapse-sync-v1.db'
const DEVICE_ID_KEY = 'synapse_sync_device_id_v1'

export type PharmacySalePayload = {
  paymentMethod: string
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

async function getStore(): Promise<SQLiteSyncOutboxStore> {
  if (!storePromise) {
    storePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then((database) => {
      const store = new SQLiteSyncOutboxStore(
        database as unknown as SyncSQLiteConnection,
      )
      return store.initialize().then(() => store)
    })
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

export async function commitPharmacySale(
  params: CommitSaleParams,
): Promise<SyncCommand> {
  const commandId = Crypto.randomUUID()
  const payload = params.payload as unknown as Record<string, unknown>
  const command: SyncCommand = {
    commandId,
    commandType: 'pharmacy.sale.complete.v1',
    schemaVersion: SYNC_SCHEMA_VERSION,
    tenantId: params.tenantId,
    // Pharmacy tenants are the current mobile facility boundary in Milestone A.
    facilityId: params.tenantId,
    deviceId: await getSyncDeviceId(),
    actorId: params.actorId,
    aggregateType: 'pharmacy_sale',
    aggregateId: commandId,
    capturedAtClient: new Date().toISOString(),
    payload,
    payloadHash: await expoPayloadHash(payload),
  }

  const runtime = new SyncRuntime(params.tenantId, await getStore(), expoPayloadHash)
  await runtime.commit(command)
  return command
}

export async function syncPharmacySales(
  tenantId: string,
  token: string,
): Promise<SyncFlushSummary> {
  const store = await getStore()
  // Serialize foreground timer/manual retries per tenant. Server idempotency
  // remains the cross-process safeguard after a crash or app restart.
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
