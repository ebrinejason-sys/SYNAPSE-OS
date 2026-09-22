import { allocatePurchaseIdempotencyKey } from '../../../packages/db/src/pharmacy-purchases'

/**
 * Local purchase entry lifecycle.
 * Only DRAFT is persisted offline today — a purchase is never treated as committed
 * until the server confirms receive (SYNCED). Full SyncCommand purchase apply is
 * intentionally out of scope until inventory idempotency is wired through the outbox.
 */
export const PURCHASE_LOCAL_STATUSES = [
  'DRAFT',
  'QUEUED',
  'SYNCING',
  'SYNCED',
  'FAILED',
  'CONFLICT',
] as const

export type PurchaseLocalStatus = (typeof PURCHASE_LOCAL_STATUSES)[number]

export const PURCHASE_DRAFT_STORAGE_KEY = 'synapse.pharmacy.purchase.draft.v1'

export type PurchaseLineDraft = {
  clientItemId: string
  productId: string
  productName: string
  quantity: string
  unitCost: string
  sellingPrice: string
  batchNumber: string
  expiryDate: string
}

export type NewProductDraft = {
  name: string
  genericName: string
  brand: string
  strength: string
  dosageForm: string
  unit: string
  barcode: string
  sku: string
  manufacturer: string
  category: string
  sellingPrice: string
  reorderLevel: string
}

export type PersistedPurchaseDraft = {
  status: 'DRAFT'
  supplierId: string
  invoice: string
  lines: PurchaseLineDraft[]
  idempotencyKey: string | null
  updatedAt: string
}

export function emptyNewProductDraft(barcode = ''): NewProductDraft {
  return {
    name: '',
    genericName: '',
    brand: '',
    strength: '',
    dosageForm: '',
    unit: 'Tablet',
    barcode,
    sku: '',
    manufacturer: '',
    category: 'General',
    sellingPrice: '',
    reorderLevel: '',
  }
}

export function resetPurchaseDraft(randomUUID: () => string) {
  return {
    supplierId: '',
    invoice: '',
    query: '',
    hits: [] as Array<{ id: string; name: string }>,
    lines: [] as PurchaseLineDraft[],
    qty: '1',
    cost: '',
    sell: '',
    batch: '',
    expiry: '',
    picked: null as { id: string; name: string; costPrice?: number | null; price?: number | null } | null,
    newSupplierName: '',
    createProduct: false,
    newProduct: emptyNewProductDraft(),
    dupes: [] as Array<{
      id: string
      name: string
      strength?: string | null
      dosageForm?: string | null
      genericName?: string | null
      brandName?: string | null
      sku?: string | null
      barcode?: string | null
      score: number
    }>,
    idempotencyKey: null as string | null,
    searched: false,
    nextLineId: () => randomUUID(),
  }
}

export function keyForSubmit(existing: string | null, randomUUID: () => string): string {
  return allocatePurchaseIdempotencyKey(existing, randomUUID)
}

export function looksLikeBarcode(value: string): boolean {
  return /^\d{6,}$/.test(value.trim())
}

export function buildPersistedPurchaseDraft(input: {
  supplierId: string
  invoice: string
  lines: PurchaseLineDraft[]
  idempotencyKey: string | null
  now?: string
}): PersistedPurchaseDraft | null {
  if (!input.supplierId && input.lines.length === 0 && !input.invoice.trim()) return null
  return {
    status: 'DRAFT',
    supplierId: input.supplierId,
    invoice: input.invoice,
    lines: input.lines,
    idempotencyKey: input.idempotencyKey,
    updatedAt: input.now ?? new Date().toISOString(),
  }
}

export function parsePersistedPurchaseDraft(raw: string | null | undefined): PersistedPurchaseDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPurchaseDraft>
    if (parsed.status !== 'DRAFT') return null
    if (!Array.isArray(parsed.lines)) return null
    const lines = parsed.lines
      .filter((line) => line && typeof line === 'object')
      .map((line) => ({
        clientItemId: String(line.clientItemId ?? ''),
        productId: String(line.productId ?? ''),
        productName: String(line.productName ?? ''),
        quantity: String(line.quantity ?? ''),
        unitCost: String(line.unitCost ?? ''),
        sellingPrice: String(line.sellingPrice ?? ''),
        batchNumber: String(line.batchNumber ?? ''),
        expiryDate: String(line.expiryDate ?? ''),
      }))
      .filter((line) => line.clientItemId && line.productId)
    return {
      status: 'DRAFT',
      supplierId: String(parsed.supplierId ?? ''),
      invoice: String(parsed.invoice ?? ''),
      lines,
      idempotencyKey:
        typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey.trim()
          ? parsed.idempotencyKey.trim()
          : null,
      updatedAt: String(parsed.updatedAt ?? ''),
    }
  } catch {
    return null
  }
}

export function purchaseLocalStatusLabel(status: PurchaseLocalStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Local draft — not received on server'
    case 'QUEUED':
      return 'Queued for sync'
    case 'SYNCING':
      return 'Syncing to server'
    case 'SYNCED':
      return 'Server confirmed'
    case 'FAILED':
      return 'Sync failed — inventory unchanged'
    case 'CONFLICT':
      return 'Conflict — resolve before retry'
    default:
      return status
  }
}
