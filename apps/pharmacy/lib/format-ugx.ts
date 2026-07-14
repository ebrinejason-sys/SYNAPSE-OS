/** Integer UGX display — no decimals. */
export function formatUgx(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : Number(amount ?? 0)
  if (!Number.isFinite(n)) return "UGX 0"
  return `UGX ${Math.round(n).toLocaleString("en-UG")}`
}

export function effectiveMonthlyUgx(priceUgx: number, billingCycle: string): number {
  if (billingCycle === "quarterly") return Math.round(priceUgx / 3)
  if (billingCycle === "yearly") return Math.round(priceUgx / 12)
  return Math.round(priceUgx)
}

export function savingsVsMonthly(
  priceUgx: number,
  billingCycle: string,
  monthlyPriceUgx: number,
): number | null {
  if (billingCycle === "quarterly") return monthlyPriceUgx * 3 - priceUgx
  if (billingCycle === "yearly") return monthlyPriceUgx * 12 - priceUgx
  return null
}
