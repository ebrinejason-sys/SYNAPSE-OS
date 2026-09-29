import { describe, expect, it } from "vitest"
import { encodePaymentRef, settlePayment } from "./partial-payment"

describe("settlePayment", () => {
  it("records full cash with change", () => {
    const s = settlePayment(10000, 12000)
    expect(s.isFullyPaid).toBe(true)
    expect(s.isPartial).toBe(false)
    expect(s.change).toBe(2000)
    expect(s.balanceDue).toBe(0)
  })

  it("records underpayment as balance due (partial)", () => {
    const s = settlePayment(10000, 6000)
    expect(s.isPartial).toBe(true)
    expect(s.isFullyPaid).toBe(false)
    expect(s.amountPaid).toBe(6000)
    expect(s.balanceDue).toBe(4000)
    expect(s.change).toBe(0)
  })

  it("treats zero paid as full balance due", () => {
    const s = settlePayment(8500, 0)
    expect(s.balanceDue).toBe(8500)
    expect(s.isPartial).toBe(true)
  })

  it("encodes payment ref for monitoring", () => {
    expect(encodePaymentRef({ amountPaid: 6000, balanceDue: 4000, method: "CASH" })).toBe(
      "PAID:6000|BAL:4000|M:CASH",
    )
  })
})
