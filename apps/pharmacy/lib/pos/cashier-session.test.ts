import { describe, expect, it } from "vitest"
import {
  canOpenTill,
  canRecordSale,
  cashVariance,
  closeRequiresReason,
  expectedCash,
  paymentStateForMethod,
  statusAfterSale,
  validateClose,
} from "@synapse/db/cashier-session"

const totals = {
  openingFloat: 100_000,
  cashPaymentTotal: 50_000,
  cashRefundTotal: 5_000,
  cashIn: 2_000,
  cashOut: 1_000,
}

describe("cashier till lifecycle", () => {
  it("blocks a second open till", () => {
    expect(canOpenTill(true)).toEqual({ ok: false, code: "TILL_ALREADY_OPEN" })
    expect(canOpenTill(false)).toEqual({ ok: true })
  })

  it("allows sales only on open or active tills", () => {
    expect(canRecordSale("open").ok).toBe(true)
    expect(canRecordSale("active").ok).toBe(true)
    expect(canRecordSale("closed")).toEqual({ ok: false, code: "TILL_NOT_OPEN" })
  })

  it("promotes OPEN to ACTIVE after the first sale", () => {
    expect(statusAfterSale("open")).toBe("active")
    expect(statusAfterSale("active")).toBe("active")
  })

  it("computes expected cash without double-counting", () => {
    expect(expectedCash(totals)).toBe(146_000)
  })

  it("requires a variance reason when counted cash differs", () => {
    const expected = expectedCash(totals)
    expect(closeRequiresReason(cashVariance(expected, expected))).toBe(false)
    expect(closeRequiresReason(cashVariance(expected, expected - 500))).toBe(true)
    const close = validateClose({
      status: "active",
      countedCash: expected - 500,
      totals,
    })
    expect(close.ok).toBe(false)
    if (!close.ok) expect(close.code).toBe("TILL_VARIANCE_REQUIRES_REASON")
  })

  it("never treats offline card/momo as captured", () => {
    expect(paymentStateForMethod({ method: "card", offline: true })).toBe("offline_unverified")
    expect(paymentStateForMethod({ method: "mobile_money", offline: true })).toBe("offline_unverified")
    expect(paymentStateForMethod({ method: "cash", offline: true })).toBe("captured")
    expect(paymentStateForMethod({ method: "card", offline: false, providerConfirmed: true })).toBe(
      "captured",
    )
  })
})
