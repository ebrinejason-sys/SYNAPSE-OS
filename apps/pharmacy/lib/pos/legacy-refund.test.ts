import { describe, expect, it } from "vitest"
import { LEGACY_ORDER_REFUND_WARNING, planLegacyOrderRefund } from "./legacy-refund"

describe("legacy order refund stock authority", () => {
  const lines = [
    { id: "line-1", productId: "prod-1", unitPrice: 1000, quantity: 4 },
    { id: "line-2", productId: "prod-2", unitPrice: 500, quantity: 2 },
  ]

  it("computes money without increasing product.quantity or creating a batch", () => {
    const plan = planLegacyOrderRefund(lines)
    expect(plan.refundAmount).toBe(5000)
    expect(plan.productQuantityDelta).toBe(0)
    expect(plan.batchesToCreate).toBe(0)
    expect(plan.sellableDelta).toBe(0)
    expect(plan.stockMutations).toEqual([])
  })

  it("partial line refunds still do not mutate sellable stock", () => {
    const plan = planLegacyOrderRefund(lines, [{ id: "line-1", quantity: 1 }])
    expect(plan.refundAmount).toBe(1000)
    expect(plan.productQuantityDelta).toBe(0)
    expect(plan.sellableDelta).toBe(0)
    expect(plan.batchesToCreate).toBe(0)
  })

  it("documents the non-sellable outcome and does not claim quantity restore", () => {
    expect(LEGACY_ORDER_REFUND_WARNING.toLowerCase()).toContain(
      "not automatically returned to sellable inventory",
    )
    expect(LEGACY_ORDER_REFUND_WARNING.toLowerCase()).not.toContain("restored product quantity")
  })
})
