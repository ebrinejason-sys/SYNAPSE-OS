import {
  OfflineEngine,
  catalogAgeMs,
  pendingCommands,
  saleCommandToApiBody,
  type CatalogIdentity,
  type CatalogProduct,
  type CatalogSnapshot,
  type CommitSaleInput,
  type SaleCommand,
} from "@synapse/offline"
import { BrowserOfflineStore } from "./browser-store"

let enginePromise: Promise<OfflineEngine> | null = null

export async function pharmacyOffline(): Promise<OfflineEngine> {
  if (typeof window === "undefined") {
    throw new Error("Pharmacy offline engine is browser-only")
  }
  if (!enginePromise) {
    enginePromise = BrowserOfflineStore.open().then((store) => new OfflineEngine(store))
  }
  return enginePromise
}

export async function persistCatalogSnapshot(params: {
  tenantId: string
  products: CatalogProduct[]
  settings?: unknown
  staff?: unknown
  identity?: CatalogIdentity | null
}): Promise<void> {
  const engine = await pharmacyOffline()
  const existing = await engine.getSnapshot(params.tenantId)
  const snapshot: CatalogSnapshot = {
    tenantId: params.tenantId,
    capturedAt: new Date().toISOString(),
    identity: params.identity ?? existing?.identity ?? null,
    products: params.products,
    settings: params.settings ?? existing?.settings ?? null,
    staff: params.staff ?? existing?.staff ?? null,
  }
  await engine.saveSnapshot(snapshot)
  await engine.setMeta("lastTenantId", params.tenantId)
}

export async function persistOfflineIdentity(identity: CatalogIdentity): Promise<void> {
  const engine = await pharmacyOffline()
  const existing = await engine.getSnapshot(identity.tenantId)
  if (!existing) {
    await engine.saveSnapshot({
      tenantId: identity.tenantId,
      capturedAt: new Date(0).toISOString(),
      identity,
      products: [],
      settings: null,
      staff: null,
    })
    await engine.setMeta("lastTenantId", identity.tenantId)
    return
  }
  await engine.saveSnapshot({ ...existing, identity })
  await engine.setMeta("lastTenantId", identity.tenantId)
}

export async function loadOfflineCatalog(tenantId: string) {
  const engine = await pharmacyOffline()
  return engine.projectedCatalog(tenantId)
}

export async function commitOfflineSale(input: CommitSaleInput) {
  const engine = await pharmacyOffline()
  return engine.commitSale(input)
}

export type SalePoster = (command: SaleCommand) => Promise<{
  status: number
  body: { code?: string; error?: string; sale?: unknown; ok?: boolean }
}>

export async function postSaleCommand(command: SaleCommand): Promise<{
  status: number
  body: { code?: string; error?: string; sale?: unknown; ok?: boolean }
}> {
  try {
    const response = await fetch("/api/admin/pos/complete-sale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": command.payload.idempotencyKey,
      },
      body: JSON.stringify(saleCommandToApiBody(command)),
    })
    const body = (await response.json().catch(() => ({}))) as {
      code?: string
      error?: string
      sale?: unknown
      ok?: boolean
    }
    return { status: response.status, body }
  } catch (err) {
    return {
      status: 0,
      body: { error: err instanceof Error ? err.message : "Network error" },
    }
  }
}

export async function syncOfflineSales(
  tenantId: string,
  poster: SalePoster = postSaleCommand,
): Promise<{ synced: number; remaining: number; conflicts: number; needsAuth: boolean }> {
  const engine = await pharmacyOffline()
  const due = await engine.commandsDue(tenantId)
  let synced = 0
  let needsAuth = false
  for (const queued of due) {
    const sending = await engine.markSending(queued.commandId)
    if (!sending) continue
    const { status, body } = await poster(sending)
    const kind = await engine.applySyncResult(sending, status, body)
    if (kind === "accepted") synced += 1
    if (kind === "auth") {
      needsAuth = true
      break
    }
  }
  const after = await engine.projectedCatalog(tenantId)
  return {
    synced,
    remaining: after.pendingCount,
    conflicts: after.conflictCount,
    needsAuth,
  }
}

export async function pendingOfflineCount(): Promise<number> {
  try {
    const engine = await pharmacyOffline()
    const all = await engine.listAllCommands()
    return pendingCommands(all).length
  } catch {
    return 0
  }
}

export { catalogAgeMs }
