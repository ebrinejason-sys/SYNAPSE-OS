import { describe, expect, it } from "vitest"
import {
  catalogueBatchMutationForbidden,
  catalogueOpeningQuantity,
  catalogueQuantityPatchForbidden,
} from "./catalogue-write"

describe("catalogue writes", () => {
  it("never opens a product with client-supplied quantity", () => {
    expect(catalogueOpeningQuantity(40)).toBe(0)
    expect(catalogueOpeningQuantity("12")).toBe(0)
    expect(catalogueOpeningQuantity(undefined)).toBe(0)
  })

  it("rejects PATCH bodies that try to set quantity", () => {
    expect(catalogueQuantityPatchForbidden({ name: "Amox" })).toBe(false)
    expect(catalogueQuantityPatchForbidden({ quantity: 12 })).toBe(true)
    expect(catalogueQuantityPatchForbidden({ quantity: 0 })).toBe(true)
  })

  it("rejects PATCH bodies that insert or rewrite batch quantities", () => {
    expect(catalogueBatchMutationForbidden({})).toBe(false)
    expect(catalogueBatchMutationForbidden({ batches: [{ id: "b1", batchNumber: "A" }] })).toBe(false)
    expect(catalogueBatchMutationForbidden({ batches: [{ batchNumber: "NEW", quantity: 10 }] })).toBe(true)
    expect(catalogueBatchMutationForbidden({ batches: [{ id: "b1", quantity: 99 }] })).toBe(true)
    expect(catalogueBatchMutationForbidden({ deletedBatchIds: ["b1"] })).toBe(true)
  })
})
