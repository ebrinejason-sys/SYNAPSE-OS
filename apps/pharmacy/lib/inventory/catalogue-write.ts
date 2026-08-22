/**
 * Catalogue writes must never invent sellable stock.
 * Opening quantity is always 0; stock enters only via receive_pharmacy_stock.
 */

export function catalogueOpeningQuantity(_requested?: unknown): 0 {
  return 0
}

export function catalogueQuantityPatchForbidden(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, "quantity") && body.quantity != null
}

export function catalogueBatchMutationForbidden(body: Record<string, unknown>): boolean {
  const batches = body.batches
  const deleted = body.deletedBatchIds
  if (Array.isArray(deleted) && deleted.length > 0) return true
  if (!Array.isArray(batches) || batches.length === 0) return false
  return batches.some((batch) => {
    if (!batch || typeof batch !== "object") return false
    const row = batch as Record<string, unknown>
    return row.quantity != null || !row.id
  })
}
