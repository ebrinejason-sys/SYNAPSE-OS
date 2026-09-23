/**
 * POS partial / underpayment helpers.
 * When cash received < sale total, the shortfall is customer balance due
 * (credit ledger) and must appear on the receipt for monitoring.
 */

export type PaymentSettlement = {
  /** Gross sale total (after tax). */
  total: number
  /** Cash/mobile/card tendered by the customer. */
  amountPaid: number
  /** amountPaid - total when overpaid; else 0. */
  change: number
  /** total - amountPaid when underpaid; else 0. */
  balanceDue: number
  /** True when customer still owes money. */
  isPartial: boolean
  /** True when fully settled in cash (paid >= total). */
  isFullyPaid: boolean
}

export function settlePayment(total: number, amountPaidRaw: number | string | null | undefined): PaymentSettlement {
  const totalSafe = Math.max(0, Number(total) || 0)
  const paid = Math.max(0, Number(amountPaidRaw) || 0)
  const change = paid > totalSafe ? roundMoney(paid - totalSafe) : 0
  const balanceDue = paid < totalSafe ? roundMoney(totalSafe - paid) : 0
  return {
    total: roundMoney(totalSafe),
    amountPaid: roundMoney(paid),
    change,
    balanceDue,
    isPartial: balanceDue > 0,
    isFullyPaid: balanceDue === 0 && totalSafe > 0,
  }
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Encode settlement into payment_ref for audit / monitoring without a schema change. */
export function encodePaymentRef(params: {
  amountPaid: number
  balanceDue: number
  method: string
  existingRef?: string | null
}): string {
  const base = params.existingRef?.trim() || ""
  const tag = `PAID:${params.amountPaid}|BAL:${params.balanceDue}|M:${params.method}`
  return base ? `${base}|${tag}` : tag
}
