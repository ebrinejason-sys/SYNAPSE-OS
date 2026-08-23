import { describe, expect, it } from "vitest"
import { classifyBatch, reconcileProductStore } from "@/lib/inventory/reconciliation"

describe("inventory integrity", () => {
  it("never treats expired or quarantined batches as sellable", () => {
    expect(classifyBatch({ quantity: 5, status: "active", expiryDate: "2099-01-01" }).sellable).toBe(5)
    expect(classifyBatch({ quantity: 5, status: "quarantined" }).sellable).toBe(0)
    expect(classifyBatch({ quantity: 5, status: "active", expiryDate: "2020-01-01", today: "2026-08-23" }).expired).toBe(5)
  })

  it("flags negative batches and over-reservation without auto-fixing", () => {
    const row = reconcileProductStore({
      productId: "p1",
      storeId: "s1",
      batches: [
        { quantity: -2, status: "active", expiryDate: "2099-01-01" },
        { quantity: 4, status: "active", expiryDate: "2099-01-01" },
      ],
      reservedOffline: 10,
    })
    expect(row.issues).toEqual(expect.arrayContaining(["negative_batch", "offline_reservation_exceeds_sellable"]))
    expect(row.sellableTotal).toBe(4)
  })
})
