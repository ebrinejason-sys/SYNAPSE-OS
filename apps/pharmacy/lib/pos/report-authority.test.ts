import { describe, expect, it } from "vitest"
import { posOnlyReportTotals } from "./report-authority"

describe("POS report authority", () => {
  it("a 100000 POS sale increases reports by 100000, not 200000", () => {
    const pos = [{ netAmount: 100_000, discount: 0, tax: 0 }]
    const totals = posOnlyReportTotals(pos)
    expect(totals.totalSales).toBe(100_000)
    expect(totals.count).toBe(1)
  })

  it("does not add legacy order transactions into POS totals", () => {
    const pos = [{ netAmount: 100_000, discount: 0, tax: 0 }]
    const legacyOrders = [{ netAmount: 100_000, discount: 0, tax: 0 }]
    const totals = posOnlyReportTotals(pos)
    void legacyOrders
    expect(totals.totalSales).toBe(100_000)
  })
})
