import { describe, expect, it } from "vitest"
import { AUTHORITATIVE_SALE_LEDGER, includeLegacyOrderRevenue } from "./sale-ledger"

describe("financial authority", () => {
  it("uses pharmacy_pos_sales as the future ledger", () => {
    expect(AUTHORITATIVE_SALE_LEDGER).toBe("pharmacy_pos_sales")
  })

  it("does not include legacy order txs unless explicitly opted in", () => {
    expect(includeLegacyOrderRevenue()).toBe(false)
    expect(includeLegacyOrderRevenue(false)).toBe(false)
    expect(includeLegacyOrderRevenue(true)).toBe(true)
  })
})
