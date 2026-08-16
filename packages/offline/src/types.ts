export const SALE_COMMAND_TYPE = "pharmacy.sale.complete.v1" as const

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000

export const OFFLINE_ALLOWED_PAYMENTS = ["CASH", "MOBILE_MONEY", "CARD"] as const

export type OfflinePaymentMethod = (typeof OFFLINE_ALLOWED_PAYMENTS)[number]

export type CommandState =
  | "queued"
  | "sending"
  | "accepted"
  | "conflict"
  | "rejected"
  | "dead-letter"

export type CatalogBatch = {
  id: string
  batchNumber: string
  quantity: number
  expiryDate: string | null
  costPrice?: number | null
  manufacturer?: string | null
}

export type CatalogProduct = {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  price: number
  costPrice?: number | null
  quantity: number
  sellableQuantity?: number
  unitOfMeasure?: string
  strength?: string | null
  dosageForm?: string | null
  isActive?: boolean
  requiresPrescription?: boolean
  packages?: Array<{
    id: string
    name: string
    unitsPerPackage: number
    price: number
    isDefault: boolean
  }>
  batches: CatalogBatch[]
}

export type CatalogIdentity = {
  tenantId: string
  actorId: string
  actorName: string
  isAdmin: boolean
  pharmacyRole: string
}

export type CatalogSnapshot = {
  tenantId: string
  capturedAt: string
  identity: CatalogIdentity | null
  products: CatalogProduct[]
  settings: unknown
  staff: unknown
}

export type SaleLineInput = {
  productId: string
  productName: string
  sku?: string | null
  quantity: number
  listPrice: number
  unitPrice: number
  discountAmount: number
  discountReason: string | null
  discountApprovedBy: string | null
  costPrice: number
  packageName: string | null
  packageQuantity: number | null
}

export type BatchAllocation = {
  batchId: string
  batchNumber: string
  expiryDate: string | null
  manufacturer: string | null
  quantity: number
  costPrice: number | null
}

export type SaleCommandPayload = {
  idempotencyKey: string
  localReceiptNumber: string
  paymentMethod: string
  taxAmount: number
  receiptStaffName: string
  clientName: string
  clientPhone: string
  clientAddress: string
  items: Array<
    SaleLineInput & {
      batchId: string | null
      allocations: BatchAllocation[]
    }
  >
}

export type SaleCommand = {
  commandId: string
  commandType: typeof SALE_COMMAND_TYPE
  schemaVersion: 1
  tenantId: string
  actorId: string
  deviceId: string
  capturedAtClient: string
  localCommittedAt: string
  payloadHash: string
  payload: SaleCommandPayload
  state: CommandState
  attemptCount: number
  nextRetryAt: string | null
  lastError: string | null
  serverSaleId: string | null
  serverReceiptNumber: string | null
  serverResponse: unknown
}

export type CommitSaleInput = {
  tenantId: string
  actorId: string
  paymentMethod: string
  taxAmount: number
  receiptStaffName: string
  clientName?: string
  clientPhone?: string
  clientAddress?: string
  items: SaleLineInput[]
  idempotencyKey?: string
}

export type CommitSaleOk = {
  ok: true
  command: SaleCommand
}

export type CommitSaleErr = {
  ok: false
  code:
    | "CREDIT_BLOCKED"
    | "PAYMENT_BLOCKED"
    | "NO_CATALOG"
    | "STALE_CATALOG"
    | "MISSING_IDENTITY"
    | "EMPTY_CART"
    | "INSUFFICIENT_STOCK"
    | "PRODUCT_INACTIVE"
  error: string
}

export type SyncClassification = "accepted" | "auth" | "conflict" | "rejected" | "retry"

export const RESERVING_STATES: ReadonlySet<CommandState> = new Set([
  "queued",
  "sending",
  "conflict",
  "rejected",
  "dead-letter",
])
