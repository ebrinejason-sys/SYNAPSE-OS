/**
 * Tally-style product history — merge purchases, sales, and stock adjustments
 * into a chronological stock ledger for one product.
 */

export type ProductHistoryKind = "PURCHASE" | "SALE" | "ADJUSTMENT" | "PHYSICAL"

export type ProductHistoryEvent = {
  id: string
  kind: ProductHistoryKind
  occurredAt: string
  quantity: number
  /** Signed stock effect: +in, −out */
  stockDelta: number
  unitCost: number | null
  unitPrice: number | null
  reference: string | null
  notes: string | null
  balanceAfter: number | null
}

export function sortProductHistory(
  events: ProductHistoryEvent[],
): ProductHistoryEvent[] {
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.occurredAt) || 0
    const tb = Date.parse(b.occurredAt) || 0
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })
}

/** Walking balance from an opening quantity through chronological events. */
export function withRunningBalances(
  events: ProductHistoryEvent[],
  openingQty: number,
): ProductHistoryEvent[] {
  let bal = openingQty
  return sortProductHistory(events).map((ev) => {
    bal += ev.stockDelta
    return { ...ev, balanceAfter: bal }
  })
}

export function mapPurchaseItemEvent(row: {
  id: string
  quantity?: number | null
  unit_cost?: number | null
  selling_price?: number | null
  batch_number?: string | null
  created_at?: string | null
  purchase?: { purchase_no?: string | null; purchase_date?: string | null; created_at?: string | null } | null
}): ProductHistoryEvent {
  const qty = Number(row.quantity ?? 0)
  return {
    id: `purchase:${row.id}`,
    kind: "PURCHASE",
    occurredAt: String(row.purchase?.purchase_date ?? row.purchase?.created_at ?? row.created_at ?? new Date(0).toISOString()),
    quantity: qty,
    stockDelta: qty,
    unitCost: row.unit_cost != null ? Number(row.unit_cost) : null,
    unitPrice: row.selling_price != null ? Number(row.selling_price) : null,
    reference: row.purchase?.purchase_no ?? null,
    notes: row.batch_number ? `Batch ${row.batch_number}` : null,
    balanceAfter: null,
  }
}

export function mapSaleItemEvent(row: {
  id: string
  quantity?: number | null
  unit_price?: number | null
  created_at?: string | null
  sale?: { receipt_number?: string | null; created_at?: string | null; confirmed_at?: string | null } | null
}): ProductHistoryEvent {
  const qty = Number(row.quantity ?? 0)
  return {
    id: `sale:${row.id}`,
    kind: "SALE",
    occurredAt: String(row.sale?.confirmed_at ?? row.sale?.created_at ?? row.created_at ?? new Date(0).toISOString()),
    quantity: qty,
    stockDelta: -qty,
    unitCost: null,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    reference: row.sale?.receipt_number ?? null,
    notes: null,
    balanceAfter: null,
  }
}

export function mapAdjustmentEvent(row: {
  id: string
  quantity?: number | null
  type?: string | null
  reason?: string | null
  previous_qty?: number | null
  new_qty?: number | null
  created_at?: string | null
}): ProductHistoryEvent {
  const type = String(row.type ?? "CORRECTION").toUpperCase()
  const prev = row.previous_qty != null ? Number(row.previous_qty) : null
  const next = row.new_qty != null ? Number(row.new_qty) : null
  const delta =
    prev != null && next != null
      ? next - prev
      : type === "DECREASE"
        ? -Math.abs(Number(row.quantity ?? 0))
        : Number(row.quantity ?? 0)
  return {
    id: `adj:${row.id}`,
    kind: type === "PHYSICAL" ? "PHYSICAL" : "ADJUSTMENT",
    occurredAt: String(row.created_at ?? new Date(0).toISOString()),
    quantity: Math.abs(delta),
    stockDelta: delta,
    unitCost: null,
    unitPrice: null,
    reference: type,
    notes: row.reason ?? null,
    balanceAfter: next,
  }
}
