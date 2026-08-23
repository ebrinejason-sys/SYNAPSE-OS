export type InventoryIntegrityRow = {
  productId: string
  storeId: string | null
  batchTotal: number
  sellableTotal: number
  quarantined: number
  expired: number
  damaged: number
  recalled: number
  issues: string[]
}

export function classifyBatch(params: {
  quantity: number
  status?: string | null
  expiryDate?: string | null
  today?: string
}): { sellable: number; quarantined: number; expired: number; damaged: number; recalled: number } {
  const qty = Number(params.quantity ?? 0)
  const status = (params.status ?? "active").toLowerCase()
  const today = params.today ?? new Date().toISOString().slice(0, 10)
  const expired = Boolean(params.expiryDate && params.expiryDate < today)
  if (status === "quarantined") return { sellable: 0, quarantined: qty, expired: 0, damaged: 0, recalled: 0 }
  if (status === "damaged") return { sellable: 0, quarantined: 0, expired: 0, damaged: qty, recalled: 0 }
  if (status === "recalled") return { sellable: 0, quarantined: 0, expired: 0, damaged: 0, recalled: qty }
  if (expired || status === "expired") return { sellable: 0, quarantined: 0, expired: qty, damaged: 0, recalled: 0 }
  if (status === "active") return { sellable: Math.max(qty, 0), quarantined: 0, expired: 0, damaged: 0, recalled: 0 }
  return { sellable: 0, quarantined: 0, expired: 0, damaged: 0, recalled: 0 }
}

export function reconcileProductStore(params: {
  productId: string
  storeId: string | null
  batches: Array<{ quantity: number; status?: string | null; expiryDate?: string | null }>
  reservedOffline?: number
  inTransit?: number
}): InventoryIntegrityRow {
  const today = new Date().toISOString().slice(0, 10)
  let sellableTotal = 0
  let quarantined = 0
  let expired = 0
  let damaged = 0
  let recalled = 0
  let batchTotal = 0
  const issues: string[] = []
  for (const batch of params.batches) {
    const qty = Number(batch.quantity ?? 0)
    batchTotal += qty
    if (qty < 0) issues.push("negative_batch")
    const classified = classifyBatch({ ...batch, today })
    sellableTotal += classified.sellable
    quarantined += classified.quarantined
    expired += classified.expired
    damaged += classified.damaged
    recalled += classified.recalled
  }
  const reserved = params.reservedOffline ?? 0
  if (reserved > sellableTotal) issues.push("offline_reservation_exceeds_sellable")
  return {
    productId: params.productId,
    storeId: params.storeId,
    batchTotal,
    sellableTotal,
    quarantined,
    expired,
    damaged,
    recalled,
    issues,
  }
}
