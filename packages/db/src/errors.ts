/**
 * Machine-readable pharmacy domain errors.
 *
 * APIs must return this shape (or a JSON superset) instead of raw SQL.
 * UI surfaces the `humanMessage`; automation uses `code`.
 */

export const PHARMACY_ERROR_CODES = [
  "INSUFFICIENT_STOCK",
  "NO_SELLABLE_BATCHES",
  "PRODUCT_INACTIVE",
  "EXPIRED_ONLY",
  "QUARANTINED_ONLY",
  "UNBATCHED_STOCK",
  "EXPIRED_BATCH",
  "QUARANTINED_BATCH",
  "REQUIRES_BATCH",
  "REQUIRES_EXPIRY",
  "INVALID_QUANTITY",
  "EXPIRED_RECEIPT",
  "PRODUCT_NOT_FOUND",
  "BATCH_NOT_FOUND",
  "INSUFFICIENT_BATCH",
  "DUPLICATE_COMMAND",
  "COMMAND_HASH_MISMATCH",
  "ALREADY_REFUNDED",
  "SALE_NOT_REFUNDABLE",
  "ACCESS_DENIED",
  "STORE_SCOPE_DENIED",
  "OFFLINE_STOCK_STALE",
  "OFFLINE_OPERATION_UNSUPPORTED",
  "TRANSFER_STATE_INVALID",
  "TRANSFER_NOT_FOUND",
  "TRANSFER_EMPTY",
  "PAYMENT_STATE_INVALID",
  "TILL_ALREADY_OPEN",
  "TILL_NOT_OPEN",
  "TILL_ALREADY_CLOSED",
  "TILL_STATE_INVALID",
  "TILL_VARIANCE_REQUIRES_REASON",
  "RECALLED_BATCH",
  "POS_APPEND_ONLY",
  "PERMISSION",
  "UNKNOWN",
] as const

export type PharmacyErrorCode = (typeof PHARMACY_ERROR_CODES)[number]

export type PharmacyDomainError = {
  code: PharmacyErrorCode | string
  humanMessage: string
  productId?: string
  requestedQuantity?: number
  sellableQuantity?: number
  recommendedAction?: string
  correlationId?: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
}

const RECOMMENDED_ACTION: Partial<Record<PharmacyErrorCode, string>> = {
  INSUFFICIENT_STOCK: "Reduce quantity or choose another branch.",
  NO_SELLABLE_BATCHES: "Receive a genuine in-date batch before selling.",
  UNBATCHED_STOCK: "Receive this product with batch number and expiry before selling.",
  REQUIRES_BATCH: "Enter a genuine batch number.",
  REQUIRES_EXPIRY: "Enter a future expiry date.",
  EXPIRED_BATCH: "Quarantine or destroy the expired batch. Do not sell it.",
  QUARANTINED_BATCH: "A pharmacist must release or destroy quarantined stock.",
  DUPLICATE_COMMAND: "This request was already processed. Do not create a second sale.",
  COMMAND_HASH_MISMATCH: "The same command id was reused with different content. Human review required.",
  ALREADY_REFUNDED: "This sale is already voided or refunded.",
  ACCESS_DENIED: "You do not have permission for this action.",
  STORE_SCOPE_DENIED: "This staff account cannot access that store.",
  OFFLINE_STOCK_STALE: "Reconnect and refresh stock before selling offline.",
  OFFLINE_OPERATION_UNSUPPORTED: "This action is blocked while offline.",
  TRANSFER_STATE_INVALID: "Refresh the transfer. The current state cannot accept this action.",
  PAYMENT_STATE_INVALID: "Do not retry as a new payment. Inspect the existing payment status.",
  TILL_ALREADY_OPEN: "Close the current till before opening another.",
  TILL_NOT_OPEN: "Open a till session before selling or moving cash.",
  TILL_ALREADY_CLOSED: "This till is already closed. Open a new session.",
  TILL_VARIANCE_REQUIRES_REASON: "Enter a reason for the cash variance before closing.",
  RECALLED_BATCH: "Do not sell a recalled batch.",
  POS_APPEND_ONLY: "Completed sales cannot be edited. Refund or void instead.",
}

export function pharmacyDomainError(
  code: PharmacyErrorCode | string,
  humanMessage: string,
  extra: Omit<PharmacyDomainError, "code" | "humanMessage"> = {},
): PharmacyDomainError {
  const recommendedAction =
    extra.recommendedAction ??
    (typeof code === "string" ? RECOMMENDED_ACTION[code as PharmacyErrorCode] : undefined)
  return {
    code,
    humanMessage,
    ...extra,
    ...(recommendedAction ? { recommendedAction } : {}),
  }
}

export function isPharmacyErrorCode(value: string): value is PharmacyErrorCode {
  return (PHARMACY_ERROR_CODES as readonly string[]).includes(value)
}

export function httpStatusForPharmacyError(code: string): number {
  switch (code) {
    case "ACCESS_DENIED":
    case "PERMISSION":
    case "STORE_SCOPE_DENIED":
      return 403
    case "PRODUCT_NOT_FOUND":
    case "BATCH_NOT_FOUND":
    case "TRANSFER_NOT_FOUND":
    case "SALE_NOT_REFUNDABLE":
      return 404
    case "DUPLICATE_COMMAND":
      return 200
    case "COMMAND_HASH_MISMATCH":
    case "INSUFFICIENT_STOCK":
    case "INSUFFICIENT_BATCH":
    case "ALREADY_REFUNDED":
    case "TRANSFER_STATE_INVALID":
    case "PAYMENT_STATE_INVALID":
    case "TILL_ALREADY_OPEN":
    case "TILL_NOT_OPEN":
    case "TILL_ALREADY_CLOSED":
    case "TILL_VARIANCE_REQUIRES_REASON":
    case "POS_APPEND_ONLY":
      return 409
    case "OFFLINE_STOCK_STALE":
    case "OFFLINE_OPERATION_UNSUPPORTED":
      return 412
    default:
      return 400
  }
}
