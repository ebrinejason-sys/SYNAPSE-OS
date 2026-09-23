import { describe, expect, it } from "vitest"
import {
  mapAdjustmentEvent,
  mapPurchaseItemEvent,
  mapSaleItemEvent,
  withRunningBalances,
} from "./product-history"

describe("product-history", () => {
  it("builds a running balance like Tally stock item history", () => {
    const events = [
      mapPurchaseItemEvent({
        id: "p1",
        quantity: 100,
        unit_cost: 50,
        selling_price: 80,
        created_at: "2026-01-01T10:00:00Z",
        purchase: { purchase_no: "PUR-1", purchase_date: "2026-01-01", created_at: "2026-01-01T10:00:00Z" },
      }),
      mapSaleItemEvent({
        id: "s1",
        quantity: 30,
        unit_price: 80,
        created_at: "2026-01-02T10:00:00Z",
        sale: { receipt_number: "R-1", confirmed_at: "2026-01-02T10:00:00Z" },
      }),
      mapAdjustmentEvent({
        id: "a1",
        type: "PHYSICAL",
        previous_qty: 70,
        new_qty: 65,
        quantity: -5,
        reason: "Shelf count",
        created_at: "2026-01-03T10:00:00Z",
      }),
    ]
    const withBal = withRunningBalances(events, 0)
    expect(withBal.map((e) => e.balanceAfter)).toEqual([100, 70, 65])
    expect(withBal[2]?.kind).toBe("PHYSICAL")
  })
})
