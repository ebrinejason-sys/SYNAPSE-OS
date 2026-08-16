import { allocateFefoBatches, allocatedQuantity, kampalaToday } from "./fefo"
import { sha256Hex, newId } from "./sha256"
import type { OfflineStore } from "./store"
import {
  CATALOG_TTL_MS,
  OFFLINE_ALLOWED_PAYMENTS,
  RESERVING_STATES,
  SALE_COMMAND_TYPE,
  type CatalogBatch,
  type CatalogProduct,
  type CatalogSnapshot,
  type CommitSaleErr,
  type CommitSaleInput,
  type CommitSaleOk,
  type SaleCommand,
  type SyncClassification,
} from "./types"

export function catalogAgeMs(snapshot: CatalogSnapshot, now = Date.now()): number {
  return now - Date.parse(snapshot.capturedAt)
}

export function isCatalogFresh(snapshot: CatalogSnapshot, now = Date.now(), ttlMs = CATALOG_TTL_MS): boolean {
  const captured = Date.parse(snapshot.capturedAt)
  if (Number.isNaN(captured)) return false
  return now - captured <= ttlMs
}

export function isOfflinePaymentAllowed(method: string): boolean {
  return (OFFLINE_ALLOWED_PAYMENTS as readonly string[]).includes(method)
}

export function classifySyncResponse(status: number, body?: { code?: string }): SyncClassification {
  if (status >= 200 && status < 300) return "accepted"
  if (status === 401 || status === 403) return "auth"
  if (status === 409 || body?.code === "INSUFFICIENT_STOCK" || body?.code === "EXPIRED_BATCH_BLOCKED") {
    return "conflict"
  }
  if (status >= 400 && status < 500) return "rejected"
  return "retry"
}

export function retryDelayMs(attemptCount: number): number {
  const exp = Math.min(8, Math.max(0, attemptCount))
  return Math.min(5 * 60_000, 15_000 * 2 ** exp)
}

function availableBatches(
  product: CatalogProduct,
  commands: SaleCommand[],
): CatalogBatch[] {
  const reserved = new Map<string, number>()
  for (const cmd of commands) {
    if (!RESERVING_STATES.has(cmd.state)) continue
    for (const item of cmd.payload.items) {
      for (const alloc of item.allocations) {
        reserved.set(alloc.batchId, (reserved.get(alloc.batchId) ?? 0) + alloc.quantity)
      }
    }
  }
  return (product.batches ?? []).map((batch) => ({
    ...batch,
    quantity: Math.max(0, batch.quantity - (reserved.get(batch.id) ?? 0)),
  }))
}

export function projectProducts(snapshot: CatalogSnapshot, commands: SaleCommand[]): CatalogProduct[] {
  return snapshot.products.map((product) => {
    const batches = availableBatches(product, commands)
    const sellable = batches.reduce((sum, b) => sum + b.quantity, 0)
    return {
      ...product,
      batches,
      sellableQuantity: sellable,
      quantity: sellable,
    }
  })
}

export function pendingCommands(commands: SaleCommand[]): SaleCommand[] {
  return commands.filter((c) => c.state === "queued" || c.state === "sending")
}

function applyAllocationsToSnapshot(snapshot: CatalogSnapshot, command: SaleCommand): CatalogSnapshot {
  const byId = new Map(snapshot.products.map((p) => [p.id, { ...p, batches: p.batches.map((b) => ({ ...b })) }]))
  for (const item of command.payload.items) {
    const product = byId.get(item.productId)
    if (!product) continue
    for (const alloc of item.allocations) {
      const batch = product.batches.find((b) => b.id === alloc.batchId)
      if (batch) batch.quantity = Math.max(0, batch.quantity - alloc.quantity)
    }
    const sellable = product.batches.reduce((sum, b) => sum + b.quantity, 0)
    product.sellableQuantity = sellable
    product.quantity = sellable
    byId.set(item.productId, product)
  }
  return { ...snapshot, products: snapshot.products.map((p) => byId.get(p.id) ?? p) }
}

export function saleCommandToApiBody(command: SaleCommand): Record<string, unknown> {
  return {
    idempotencyKey: command.payload.idempotencyKey,
    paymentMethod: command.payload.paymentMethod,
    taxAmount: command.payload.taxAmount,
    receiptStaffName: command.payload.receiptStaffName,
    clientName: command.payload.clientName,
    clientPhone: command.payload.clientPhone,
    clientAddress: command.payload.clientAddress,
    items: command.payload.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      listPrice: item.listPrice,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      discountReason: item.discountReason,
      discountApprovedBy: item.discountApprovedBy,
      costPrice: item.costPrice,
      packageName: item.packageName,
      packageQuantity: item.packageQuantity,
      batchId: item.batchId,
    })),
  }
}

export class OfflineEngine {
  constructor(private readonly store: OfflineStore) {}

  async saveSnapshot(snapshot: CatalogSnapshot): Promise<void> {
    await this.store.saveSnapshot(snapshot)
  }

  async getSnapshot(tenantId: string): Promise<CatalogSnapshot | null> {
    return this.store.getSnapshot(tenantId)
  }

  async getMeta<T>(key: string): Promise<T | null> {
    return this.store.getMeta<T>(key)
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.store.setMeta(key, value)
  }

  async projectedCatalog(tenantId: string): Promise<{
    snapshot: CatalogSnapshot | null
    products: CatalogProduct[]
    commands: SaleCommand[]
    pendingCount: number
    conflictCount: number
    stale: boolean
  }> {
    const snapshot = await this.store.getSnapshot(tenantId)
    const commands = await this.store.listCommands(tenantId)
    if (!snapshot) {
      return {
        snapshot: null,
        products: [],
        commands,
        pendingCount: pendingCommands(commands).length,
        conflictCount: commands.filter((c) => c.state === "conflict").length,
        stale: true,
      }
    }
    return {
      snapshot,
      products: projectProducts(snapshot, commands),
      commands,
      pendingCount: pendingCommands(commands).length,
      conflictCount: commands.filter((c) => c.state === "conflict").length,
      stale: !isCatalogFresh(snapshot),
    }
  }

  async commitSale(input: CommitSaleInput, now = new Date()): Promise<CommitSaleOk | CommitSaleErr> {
    if (!input.items.length) {
      return { ok: false, code: "EMPTY_CART", error: "Cart is empty." }
    }
    if (input.paymentMethod === "CREDIT") {
      return {
        ok: false,
        code: "CREDIT_BLOCKED",
        error: "Credit sales need a live ledger. Reconnect to sell on account.",
      }
    }
    if (!isOfflinePaymentAllowed(input.paymentMethod)) {
      return {
        ok: false,
        code: "PAYMENT_BLOCKED",
        error: `${input.paymentMethod} cannot be completed offline.`,
      }
    }

    const snapshot = await this.store.getSnapshot(input.tenantId)
    if (!snapshot) {
      return {
        ok: false,
        code: "NO_CATALOG",
        error: "No local stock snapshot. Open POS while online once, then you can sell through an outage.",
      }
    }
    if (!isCatalogFresh(snapshot, now.getTime())) {
      return {
        ok: false,
        code: "STALE_CATALOG",
        error: "Local stock is older than 24 hours. Reconnect to refresh the catalog before selling.",
      }
    }
    if (!snapshot.identity?.tenantId || !snapshot.identity.actorId) {
      return {
        ok: false,
        code: "MISSING_IDENTITY",
        error: "This device has no cached cashier identity. Sign in while online first.",
      }
    }

    const commands = await this.store.listCommands(input.tenantId)
    const today = kampalaToday(now)
    const payloadItems: SaleCommand["payload"]["items"] = []

    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        return { ok: false, code: "EMPTY_CART", error: "Invalid quantity." }
      }
      const product = snapshot.products.find((p) => p.id === line.productId)
      if (!product || product.isActive === false) {
        return {
          ok: false,
          code: "PRODUCT_INACTIVE",
          error: `${line.productName || line.productId} is not in the local catalog.`,
        }
      }
      const batches = availableBatches(product, [...commands, ...commandsFromPayload(payloadItems, input.tenantId)])
      const allocations = allocateFefoBatches(batches, line.quantity, today)
      if (allocatedQuantity(allocations) < line.quantity) {
        return {
          ok: false,
          code: "INSUFFICIENT_STOCK",
          error: `Not enough local stock for ${product.name}.`,
        }
      }
      payloadItems.push({
        ...line,
        batchId: allocations[0]?.batchId ?? null,
        allocations,
      })
    }

    const deviceId = await this.store.getDeviceId()
    const seq = await this.store.nextLocalSequence(input.tenantId)
    const deviceShort = deviceId.replace(/^dev-/, "").slice(0, 6).toUpperCase()
    const localReceiptNumber = `OFF-${deviceShort}-${String(seq).padStart(4, "0")}`
    const idempotencyKey = input.idempotencyKey?.trim() || newId()
    const capturedAtClient = now.toISOString()
    const payload = {
      idempotencyKey,
      localReceiptNumber,
      paymentMethod: input.paymentMethod,
      taxAmount: input.taxAmount,
      receiptStaffName: input.receiptStaffName,
      clientName: input.clientName ?? "",
      clientPhone: input.clientPhone ?? "",
      clientAddress: input.clientAddress ?? "",
      items: payloadItems,
    }
    const payloadHash = await sha256Hex(JSON.stringify(payload))
    const command: SaleCommand = {
      commandId: newId(),
      commandType: SALE_COMMAND_TYPE,
      schemaVersion: 1,
      tenantId: input.tenantId,
      actorId: snapshot.identity.actorId,
      deviceId,
      capturedAtClient,
      localCommittedAt: capturedAtClient,
      payloadHash,
      payload,
      state: "queued",
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      serverSaleId: null,
      serverReceiptNumber: null,
      serverResponse: null,
    }
    await this.store.putCommand(command)
    const stored = await this.store.getCommand(command.commandId)
    if (!stored) {
      return { ok: false, code: "NO_CATALOG", error: "Local sale could not be persisted." }
    }
    return { ok: true, command: stored }
  }

  async listAllCommands(): Promise<SaleCommand[]> {
    return this.store.listAllCommands()
  }

  async commandsDue(tenantId: string, now = Date.now()): Promise<SaleCommand[]> {
    const commands = await this.store.listCommands(tenantId)
    return commands.filter((c) => {
      if (c.state !== "queued" && c.state !== "sending") return false
      if (!c.nextRetryAt) return true
      return Date.parse(c.nextRetryAt) <= now
    })
  }

  async markSending(commandId: string): Promise<SaleCommand | null> {
    const cmd = await this.store.getCommand(commandId)
    if (!cmd) return null
    cmd.state = "sending"
    cmd.attemptCount += 1
    await this.store.putCommand(cmd)
    return cmd
  }

  async markAccepted(command: SaleCommand, serverResponse: unknown): Promise<void> {
    const snapshot = await this.store.getSnapshot(command.tenantId)
    if (snapshot) {
      await this.store.saveSnapshot(applyAllocationsToSnapshot(snapshot, command))
    }
    const sale =
      serverResponse && typeof serverResponse === "object"
        ? (serverResponse as { sale?: Record<string, unknown> }).sale ??
          (serverResponse as Record<string, unknown>)
        : null
    command.state = "accepted"
    command.lastError = null
    command.nextRetryAt = null
    command.serverResponse = serverResponse
    command.serverSaleId =
      sale && typeof sale === "object"
        ? String((sale as { sale_id?: unknown; id?: unknown }).sale_id ?? (sale as { id?: unknown }).id ?? "") ||
          null
        : null
    command.serverReceiptNumber =
      sale && typeof sale === "object"
        ? String((sale as { receipt_number?: unknown }).receipt_number ?? "") || null
        : null
    await this.store.putCommand(command)
  }

  async markRetry(command: SaleCommand, error: string, now = Date.now()): Promise<void> {
    command.state = "queued"
    command.lastError = error
    command.nextRetryAt = new Date(now + retryDelayMs(command.attemptCount)).toISOString()
    await this.store.putCommand(command)
  }

  async markTerminal(
    command: SaleCommand,
    state: "conflict" | "rejected" | "dead-letter",
    error: string,
  ): Promise<void> {
    command.state = state
    command.lastError = error
    command.nextRetryAt = null
    await this.store.putCommand(command)
  }

  async applySyncResult(
    command: SaleCommand,
    status: number,
    body: { code?: string; error?: string; sale?: unknown } | null,
  ): Promise<SyncClassification> {
    const kind = classifySyncResponse(status, body ?? undefined)
    if (kind === "accepted") {
      await this.markAccepted(command, body)
    } else if (kind === "conflict") {
      await this.markTerminal(command, "conflict", body?.error || "Server stock conflict")
    } else if (kind === "rejected") {
      await this.markTerminal(command, "rejected", body?.error || `HTTP ${status}`)
    } else if (kind === "auth") {
      await this.markRetry(command, body?.error || "Sign in required to sync")
    } else {
      await this.markRetry(command, body?.error || `HTTP ${status}`)
    }
    return kind
  }
}

function commandsFromPayload(
  items: SaleCommand["payload"]["items"],
  tenantId: string,
): SaleCommand[] {
  if (items.length === 0) return []
  return [
    {
      commandId: "in-flight",
      commandType: SALE_COMMAND_TYPE,
      schemaVersion: 1,
      tenantId,
      actorId: "",
      deviceId: "",
      capturedAtClient: "",
      localCommittedAt: "",
      payloadHash: "",
      payload: {
        idempotencyKey: "",
        localReceiptNumber: "",
        paymentMethod: "CASH",
        taxAmount: 0,
        receiptStaffName: "",
        clientName: "",
        clientPhone: "",
        clientAddress: "",
        items,
      },
      state: "queued",
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      serverSaleId: null,
      serverReceiptNumber: null,
      serverResponse: null,
    },
  ]
}
