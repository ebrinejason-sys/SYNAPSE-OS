/**
 * Cashier / till session lifecycle — SYNAPSE Pharm v1.
 *
 * CLOSED → OPEN → ACTIVE → CLOSING → CLOSED
 * One non-closed session per (tenant, cashier).
 */

export const TILL_STATUSES = ["open", "active", "closing", "closed"] as const
export type TillStatus = (typeof TILL_STATUSES)[number]

export const TILL_OPEN_STATUSES = ["open", "active", "closing"] as const

export type TillTotals = {
  openingFloat: number
  cashPaymentTotal: number
  cashRefundTotal: number
  cashIn: number
  cashOut: number
}

export function isTillStatus(value: string): value is TillStatus {
  return (TILL_STATUSES as readonly string[]).includes(value)
}

export function isOpenTillStatus(status: string): boolean {
  return (TILL_OPEN_STATUSES as readonly string[]).includes(status)
}

export function canOpenTill(existingOpen: boolean): { ok: true } | { ok: false; code: "TILL_ALREADY_OPEN" } {
  if (existingOpen) return { ok: false, code: "TILL_ALREADY_OPEN" }
  return { ok: true }
}

export function canRecordSale(status: string): { ok: true } | { ok: false; code: "TILL_NOT_OPEN" | "TILL_STATE_INVALID" } {
  if (status === "open" || status === "active") return { ok: true }
  if (status === "closing" || status === "closed") return { ok: false, code: "TILL_NOT_OPEN" }
  return { ok: false, code: "TILL_STATE_INVALID" }
}

export function statusAfterSale(status: TillStatus): TillStatus {
  return status === "open" ? "active" : status
}

export function canBeginClose(status: string): { ok: true } | { ok: false; code: "TILL_NOT_OPEN" | "TILL_ALREADY_CLOSED" } {
  if (status === "closed") return { ok: false, code: "TILL_ALREADY_CLOSED" }
  if (status === "open" || status === "active" || status === "closing") return { ok: true }
  return { ok: false, code: "TILL_NOT_OPEN" }
}

export function expectedCash(totals: TillTotals): number {
  return (
    roundMoney(totals.openingFloat) +
    roundMoney(totals.cashPaymentTotal) -
    roundMoney(totals.cashRefundTotal) +
    roundMoney(totals.cashIn) -
    roundMoney(totals.cashOut)
  )
}

export function cashVariance(expected: number, counted: number): number {
  return roundMoney(counted) - roundMoney(expected)
}

export function closeRequiresReason(variance: number): boolean {
  return Math.abs(roundMoney(variance)) >= 0.01
}

export function validateClose(params: {
  status: string
  countedCash: number
  varianceReason?: string | null
  totals: TillTotals
}):
  | { ok: true; expectedCash: number; variance: number; nextStatus: "closed" }
  | {
      ok: false
      code: "TILL_NOT_OPEN" | "TILL_ALREADY_CLOSED" | "TILL_VARIANCE_REQUIRES_REASON" | "INVALID_QUANTITY"
    } {
  const begin = canBeginClose(params.status)
  if (!begin.ok) return begin
  if (!Number.isFinite(params.countedCash) || params.countedCash < 0) {
    return { ok: false, code: "INVALID_QUANTITY" }
  }
  const expected = expectedCash(params.totals)
  const variance = cashVariance(expected, params.countedCash)
  if (closeRequiresReason(variance) && !params.varianceReason?.trim()) {
    return { ok: false, code: "TILL_VARIANCE_REQUIRES_REASON" }
  }
  return { ok: true, expectedCash: expected, variance, nextStatus: "closed" }
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export const PAYMENT_STATES = [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "offline_unverified",
] as const
export type PaymentState = (typeof PAYMENT_STATES)[number]

/** External card/momo without provider confirmation must stay unverified. */
export function paymentStateForMethod(params: {
  method: string
  offline: boolean
  providerConfirmed?: boolean
}): PaymentState {
  const method = params.method.trim().toLowerCase()
  if (params.offline && method !== "cash") return "offline_unverified"
  if (method === "cash") return "captured"
  if (params.providerConfirmed) return "captured"
  return "pending"
}
