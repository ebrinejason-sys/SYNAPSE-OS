import { allocatePurchaseIdempotencyKey } from '../../../packages/db/src/pharmacy-purchases'

export type PurchaseLineDraft = {
  clientItemId: string
  productId: string
  productName: string
  quantity: string
  unitCost: string
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
    batch: '',
    expiry: '',
    picked: null as { id: string; name: string; costPrice?: number | null } | null,
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
