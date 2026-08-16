import type { BatchAllocation, CatalogBatch } from "./types"

export function kampalaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

function daysUntilExpiry(expiryDate: string | null, today: string): number | null {
  if (!expiryDate) return null
  const exp = expiryDate.slice(0, 10)
  const t0 = Date.parse(`${today}T00:00:00Z`)
  const t1 = Date.parse(`${exp}T00:00:00Z`)
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null
  return Math.round((t1 - t0) / 86_400_000)
}

export function allocateFefoBatches(
  batches: CatalogBatch[],
  qtyNeeded: number,
  today = kampalaToday(),
): BatchAllocation[] {
  if (qtyNeeded <= 0) return []
  const sorted = [...batches]
    .filter((b) => b.quantity > 0)
    .filter((b) => {
      const days = daysUntilExpiry(b.expiryDate, today)
      return days == null || days >= 0
    })
    .sort((a, b) => (a.expiryDate ?? "9999-12-31").localeCompare(b.expiryDate ?? "9999-12-31"))

  let remaining = qtyNeeded
  const out: BatchAllocation[] = []
  for (const b of sorted) {
    if (remaining <= 0) break
    const take = Math.min(b.quantity, remaining)
    if (take <= 0) continue
    out.push({
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      manufacturer: b.manufacturer ?? null,
      quantity: take,
      costPrice: b.costPrice ?? null,
    })
    remaining -= take
  }
  return out
}

export function allocatedQuantity(alloc: BatchAllocation[]): number {
  return alloc.reduce((sum, a) => sum + a.quantity, 0)
}
