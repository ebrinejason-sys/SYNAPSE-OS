import * as FileSystem from "expo-file-system"
import {
  MemoryOfflineStore,
  OfflineEngine,
  emptyDump,
  pendingCommands,
  saleCommandToApiBody,
  type CatalogIdentity,
  type CatalogProduct,
  type CatalogSnapshot,
  type CommitSaleInput,
  type OfflineDump,
  type SaleCommand,
} from "@synapse/offline"
import { apiRequest, ApiError } from "@/lib/api"

const FILE = `${FileSystem.documentDirectory ?? ""}synapse-pharm-pos-v1.json`

let enginePromise: Promise<OfflineEngine> | null = null

async function persistDump(dump: OfflineDump): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(dump))
}

export async function mobileOffline(): Promise<OfflineEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      let dump: OfflineDump = emptyDump()
      try {
        const raw = await FileSystem.readAsStringAsync(FILE)
        dump = JSON.parse(raw) as OfflineDump
      } catch {
        dump = emptyDump()
      }
      return new OfflineEngine(new MemoryOfflineStore(dump, persistDump))
    })()
  }
  return enginePromise
}

export async function persistMobileCatalog(params: {
  tenantId: string
  products: CatalogProduct[]
  identity?: CatalogIdentity | null
}): Promise<void> {
  const engine = await mobileOffline()
  const existing = await engine.getSnapshot(params.tenantId)
  const snapshot: CatalogSnapshot = {
    tenantId: params.tenantId,
    capturedAt: new Date().toISOString(),
    identity: params.identity ?? existing?.identity ?? null,
    products: params.products,
    settings: existing?.settings ?? null,
    staff: existing?.staff ?? null,
  }
  await engine.saveSnapshot(snapshot)
  await engine.setMeta("lastTenantId", params.tenantId)
}

export async function persistMobileIdentity(identity: CatalogIdentity): Promise<void> {
  const engine = await mobileOffline()
  const existing = await engine.getSnapshot(identity.tenantId)
  await engine.saveSnapshot({
    tenantId: identity.tenantId,
    capturedAt: existing?.capturedAt ?? new Date(0).toISOString(),
    identity,
    products: existing?.products ?? [],
    settings: existing?.settings ?? null,
    staff: existing?.staff ?? null,
  })
}

export async function loadMobileCatalog(tenantId: string) {
  const engine = await mobileOffline()
  return engine.projectedCatalog(tenantId)
}

export async function commitMobileOfflineSale(input: CommitSaleInput) {
  const engine = await mobileOffline()
  return engine.commitSale(input)
}

export async function syncMobileOfflineSales(
  tenantId: string,
  token: string,
): Promise<{ synced: number; remaining: number; conflicts: number; needsAuth: boolean }> {
  const engine = await mobileOffline()
  const due = await engine.commandsDue(tenantId)
  let synced = 0
  let needsAuth = false
  for (const queued of due) {
    const sending = await engine.markSending(queued.commandId)
    if (!sending) continue
    try {
      const data = await apiRequest<{ ok?: boolean; sale?: unknown; code?: string; error?: string }>(
        "/api/mobile/pharmacy/pos/complete-sale",
        {
          method: "POST",
          token,
          body: saleCommandToApiBody(sending),
        },
      )
      await engine.applySyncResult(sending, 200, data)
      synced += 1
    } catch (err) {
      if (err instanceof ApiError) {
        const kind = await engine.applySyncResult(sending, err.status, {
          code: typeof err.payload.code === "string" ? err.payload.code : undefined,
          error: err.message,
        })
        if (kind === "auth") {
          needsAuth = true
          break
        }
      } else {
        await engine.applySyncResult(sending, 0, {
          error: err instanceof Error ? err.message : "Network error",
        })
      }
    }
  }
  const after = await engine.projectedCatalog(tenantId)
  return { synced, remaining: after.pendingCount, conflicts: after.conflictCount, needsAuth }
}

export async function pendingMobileSaleCount(): Promise<number> {
  try {
    const engine = await mobileOffline()
    return pendingCommands(await engine.listAllCommands()).length
  } catch {
    return 0
  }
}

export function posProductToCatalog(p: {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  quantity: number
  unit: string
  requiresPrescription: boolean
  packages: CatalogProduct["packages"]
  batches: Array<{ id: string; batchNumber: string; quantity: number; expiryDate: string }>
}): CatalogProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    price: p.price,
    quantity: p.quantity,
    sellableQuantity: p.quantity,
    unitOfMeasure: p.unit,
    requiresPrescription: p.requiresPrescription,
    isActive: true,
    packages: p.packages,
    batches: p.batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
    })),
  }
}
