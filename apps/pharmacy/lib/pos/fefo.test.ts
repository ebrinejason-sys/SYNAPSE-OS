import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { allocateFefoBatches, daysUntilExpiry, expiryTone } from "./fefo.ts"

describe("FEFO allocation", () => {
  const today = "2026-07-20"
  const batches = [
    {
      id: "b-late",
      batchNumber: "LATER",
      quantity: 10,
      expiryDate: "2027-01-01",
      manufacturer: "Cipla",
    },
    {
      id: "b-soon",
      batchNumber: "SOON",
      quantity: 3,
      expiryDate: "2026-08-01",
      manufacturer: "GSK",
    },
    {
      id: "b-expired",
      batchNumber: "DEAD",
      quantity: 50,
      expiryDate: "2026-01-01",
      manufacturer: null,
    },
  ]

  it("skips expired and takes earliest expiry first", () => {
    const alloc = allocateFefoBatches(batches, 5, today)
    assert.equal(alloc.length, 2)
    assert.equal(alloc[0]!.batchNumber, "SOON")
    assert.equal(alloc[0]!.quantity, 3)
    assert.equal(alloc[1]!.batchNumber, "LATER")
    assert.equal(alloc[1]!.quantity, 2)
  })

  it("returns partial allocation when stock is short", () => {
    const alloc = allocateFefoBatches(batches, 100, today)
    const total = alloc.reduce((s, a) => s + a.quantity, 0)
    assert.equal(total, 13)
  })
})

describe("expiry badges", () => {
  it("classifies >180 green, 90–180 amber, <90 red", () => {
    assert.equal(expiryTone("2027-07-20", "2026-07-20"), "ok")
    assert.equal(daysUntilExpiry("2027-07-20", "2026-07-20"), 365)
    assert.equal(expiryTone("2026-12-01", "2026-07-20"), "warn")
    assert.equal(expiryTone("2026-08-01", "2026-07-20"), "critical")
    assert.equal(expiryTone("2026-01-01", "2026-07-20"), "expired")
  })
})
