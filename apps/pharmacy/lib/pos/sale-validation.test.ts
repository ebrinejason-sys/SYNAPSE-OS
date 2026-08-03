import { describe, expect, it } from "vitest"
import {
  concurrentLastUnitOutcome,
  extractSaleErrorCode,
  friendlySaleError,
  isValidSaleQuantity,
  saleErrorHttpStatus,
  validateSaleLine,
} from "./sale-validation"

const product = { id: "p1", price: 1000, is_active: true }

describe("isValidSaleQuantity", () => {
  it("rejects zero, negative, fractional, and non-finite", () => {
    expect(isValidSaleQuantity(0)).toBe(false)
    expect(isValidSaleQuantity(-1)).toBe(false)
    expect(isValidSaleQuantity(1.5)).toBe(false)
    expect(isValidSaleQuantity(NaN)).toBe(false)
    expect(isValidSaleQuantity(Infinity)).toBe(false)
  })

  it("accepts positive integers", () => {
    expect(isValidSaleQuantity(1)).toBe(true)
    expect(isValidSaleQuantity(12)).toBe(true)
  })
})

describe("validateSaleLine", () => {
  it("rejects invalid quantity", () => {
    const result = validateSaleLine({
      raw: { productId: "p1", quantity: 0 },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
  })

  it("rejects missing product", () => {
    const result = validateSaleLine({
      raw: { productId: "missing", quantity: 1 },
      product: null,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it("blocks cashier raising unit price without a discount path", () => {
    const result = validateSaleLine({
      raw: { productId: "p1", quantity: 1, unitPrice: 1500 },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(403)
    expect(result.error).toMatch(/discount control/i)
  })

  it("treats a lower unit price as a discount that needs a reason", () => {
    const result = validateSaleLine({
      raw: { productId: "p1", quantity: 1, unitPrice: 500 },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
    expect(result.error).toMatch(/discount_reason/i)
  })

  it("requires discount_reason when discount is applied", () => {
    const result = validateSaleLine({
      raw: { productId: "p1", quantity: 1, unitPrice: 950, discountAmount: 50 },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(400)
    expect(result.error).toMatch(/discount_reason/i)
  })

  it("requires supervisor when discount exceeds threshold", () => {
    const result = validateSaleLine({
      raw: {
        productId: "p1",
        quantity: 1,
        unitPrice: 800,
        discountAmount: 200,
        discountReason: "loyalty",
      },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(403)
    expect(result.code).toBe("DISCOUNT_APPROVAL_REQUIRED")
  })

  it("allows over-threshold discount with supervisor approval", () => {
    const result = validateSaleLine({
      raw: {
        productId: "p1",
        quantity: 1,
        unitPrice: 800,
        discountAmount: 200,
        discountReason: "loyalty",
      },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "cashier-1",
      approvedBy: "supervisor-1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rpcItem.discount_approved_by).toBe("supervisor-1")
    expect(result.rpcItem.unit_price).toBe(800)
  })

  it("builds a clean RPC line at list price", () => {
    const result = validateSaleLine({
      raw: { productId: "p1", quantity: 2, unitPrice: 1000 },
      product,
      thresholdPct: 5,
      isAdmin: false,
      actorUserId: "u1",
      approvedBy: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rpcItem).toMatchObject({
      product_id: "p1",
      quantity: 2,
      unit_price: 1000,
      list_price: 1000,
      discount_amount: 0,
    })
  })
})

describe("sale error mapping", () => {
  it("maps expired / stock conflicts to 409", () => {
    expect(saleErrorHttpStatus("EXPIRED_BATCH_BLOCKED: x")).toBe(409)
    expect(saleErrorHttpStatus("INSUFFICIENT_STOCK: x")).toBe(409)
    expect(friendlySaleError("EXPIRED_BATCH_BLOCKED: x")).toMatch(/expired/i)
    expect(extractSaleErrorCode("INSUFFICIENT_STOCK: out")).toBe("INSUFFICIENT_STOCK")
  })
})

describe("concurrent last-unit race (FEFO math)", () => {
  it("first commit wins the last unit; second gets zero", () => {
    const outcome = concurrentLastUnitOutcome({
      available: 1,
      requestA: 1,
      requestB: 1,
    })
    expect(outcome).toEqual({ aFulfilled: 1, bFulfilled: 0, leftover: 0 })
  })

  it("splits remaining stock when both request more than available", () => {
    const outcome = concurrentLastUnitOutcome({
      available: 5,
      requestA: 4,
      requestB: 4,
    })
    expect(outcome).toEqual({ aFulfilled: 4, bFulfilled: 1, leftover: 0 })
  })
})
