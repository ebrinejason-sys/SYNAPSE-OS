/**
 * Legacy pharmacy_transactions refunds are financial status changes only.
 * They must never:
 * - increase pharmacy_products.quantity
 * - insert a pharmacy_product_batches row
 * - increase sellable stock
 *
 * Returned units stay non-sellable until a pharmacist receives or quarantines
 * them through inventory RPCs.
 */
export type LegacyRefundLine = {
  id: string
  productId: string | null
  unitPrice: number
  quantity: number
}

export type LegacyRefundPlan = {
  refundAmount: number
  productQuantityDelta: number
  batchesToCreate: number
  sellableDelta: number
  stockMutations: []
}

export function planLegacyOrderRefund(
  lines: LegacyRefundLine[],
  requested?: Array<{ id: string; quantity: number }>,
): LegacyRefundPlan {
  const items =
    requested && requested.length > 0
      ? requested
      : lines.map((line) => ({
          id: line.id,
          quantity: line.quantity,
        }))

  let refundAmount = 0
  for (const item of items) {
    const original = lines.find((line) => line.id === item.id)
    if (!original) continue
    const qty = Math.min(item.quantity, original.quantity)
    refundAmount += original.unitPrice * qty
  }

  return {
    refundAmount,
    productQuantityDelta: 0,
    batchesToCreate: 0,
    sellableDelta: 0,
    stockMutations: [],
  }
}

export const LEGACY_ORDER_REFUND_WARNING =
  "Legacy order refund recorded financially only. Returned units are not automatically returned to sellable inventory. They must be received or quarantined through the proper inventory workflow."
