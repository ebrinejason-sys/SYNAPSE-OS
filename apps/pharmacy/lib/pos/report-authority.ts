/**
 * Sales-report financial authority is pharmacy_pos_sales.
 * Legacy pharmacy_transactions (orders) must not be added into POS totals.
 */
export type ReportMoneyRow = {
  netAmount: number
  discount: number
  tax: number
}

export function posOnlyReportTotals(posRows: ReportMoneyRow[]): {
  totalSales: number
  totalDiscount: number
  totalTax: number
  count: number
} {
  let totalSales = 0
  let totalDiscount = 0
  let totalTax = 0
  for (const row of posRows) {
    totalSales += Number(row.netAmount ?? 0)
    totalDiscount += Number(row.discount ?? 0)
    totalTax += Number(row.tax ?? 0)
  }
  return {
    totalSales,
    totalDiscount,
    totalTax,
    count: posRows.length,
  }
}
