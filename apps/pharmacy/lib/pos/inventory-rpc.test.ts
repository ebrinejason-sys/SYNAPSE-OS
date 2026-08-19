import { describe, it, expect } from "vitest"
import { parsePharmacyRpcError } from "@synapse/db/inventory-rpc"
import { allocateFefo, allocatedQuantity, summarizeInventory } from "@synapse/db/inventory"

describe("parsePharmacyRpcError", () => {
  it("maps REQUIRES_BATCH to pharmacy language", () => {
    const e = parsePharmacyRpcError("REQUIRES_BATCH: a genuine batch number is required")
    expect(e.code).toBe("REQUIRES_BATCH")
    expect(e.humanMessage.toLowerCase()).toContain("batch")
  })

  it("maps INSUFFICIENT_STOCK with product context", () => {
    const e = parsePharmacyRpcError("INSUFFICIENT_STOCK: Amoxicillin short by 3 units (sellable 2)")
    expect(e.code).toBe("INSUFFICIENT_STOCK")
    expect(e.humanMessage.toLowerCase()).toMatch(/amoxicillin|sellable|short/)
  })

  it("maps ALREADY_REFUNDED", () => {
    const e = parsePharmacyRpcError("ALREADY_REFUNDED: sale R-20260810-0001 already voided")
    expect(e.code).toBe("ALREADY_REFUNDED")
    expect(e.humanMessage.toLowerCase()).toContain("already")
  })

  it("maps EXPIRED_RECEIPT", () => {
    const e = parsePharmacyRpcError("EXPIRED_RECEIPT: cannot receive stock that is already expired")
    expect(e.code).toBe("EXPIRED_RECEIPT")
    expect(e.humanMessage.toLowerCase()).toContain("expired")
  })
})

describe("pilot FEFO smoke (domain)", () => {
  const TODAY = "2026-08-10"
  const batchA = {
    id: "a",
    batch_number: "BATCH-A",
    quantity: 20,
    expiry_date: "2027-06-01",
    status: "active",
    received_date: "2026-08-01",
  }
  const batchB = {
    id: "b",
    batch_number: "BATCH-B",
    quantity: 15,
    expiry_date: "2026-12-01",
    status: "active",
    received_date: "2026-08-02",
  }
  const expired = {
    id: "e",
    batch_number: "BATCH-E",
    quantity: 50,
    expiry_date: "2026-01-01",
    status: "active",
  }
  const quarantined = {
    id: "q",
    batch_number: "BATCH-Q",
    quantity: 50,
    expiry_date: "2027-01-01",
    status: "quarantined",
  }

  it("FEFO selects earlier-expiry Batch B before Batch A", () => {
    const alloc = allocateFefo([batchA, batchB], 5, { today: TODAY })
    expect(alloc[0]?.batchId).toBe("b")
    expect(allocatedQuantity(alloc)).toBe(5)
  })

  it("excludes expired and quarantined from sellable and allocation", () => {
    const s = summarizeInventory({ id: "p", name: "X", quantity: 135 }, [
      batchA,
      batchB,
      expired,
      quarantined,
    ], TODAY)
    expect(s.sellableQuantity).toBe(35)
    expect(s.expiredQuantity).toBe(50)
    expect(s.quarantinedQuantity).toBe(50)

    const alloc = allocateFefo([batchA, batchB, expired, quarantined], 100, { today: TODAY })
    expect(allocatedQuantity(alloc)).toBe(35)
    expect(alloc.every((a) => a.batchId === "a" || a.batchId === "b")).toBe(true)
  })
})
