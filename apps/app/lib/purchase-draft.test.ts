import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPersistedPurchaseDraft,
  keyForSubmit,
  parsePersistedPurchaseDraft,
  purchaseLocalStatusLabel,
  resetPurchaseDraft,
} from "./purchase-draft.ts"

describe("purchase draft reset", () => {
  it("keeps the same idempotency key across a failed retry", () => {
    const first = keyForSubmit(null, () => "key-1")
    const retry = keyForSubmit(first, () => "key-2")
    assert.equal(first, "key-1")
    assert.equal(retry, "key-1")
  })

  it("issues a new key after cancel and after a successful reset", () => {
    const previous = keyForSubmit(null, () => "key-old")
    const cancelled = resetPurchaseDraft(() => "unused")
    assert.equal(cancelled.idempotencyKey, null)
    const next = keyForSubmit(cancelled.idempotencyKey, () => "key-new")
    assert.equal(next, "key-new")
    assert.notEqual(next, previous)
  })

  it("clears supplier, lines, product search, and duplicate state together", () => {
    const draft = resetPurchaseDraft(() => "line-id")
    assert.equal(draft.supplierId, "")
    assert.equal(draft.invoice, "")
    assert.equal(draft.query, "")
    assert.equal(draft.hits.length, 0)
    assert.equal(draft.lines.length, 0)
    assert.equal(draft.picked, null)
    assert.equal(draft.createProduct, false)
    assert.equal(draft.dupes.length, 0)
    assert.equal(draft.idempotencyKey, null)
    assert.equal(draft.nextLineId(), "line-id")
  })

  it("persists and restores a local DRAFT without claiming server sync", () => {
    const payload = buildPersistedPurchaseDraft({
      supplierId: "s1",
      invoice: "INV-9",
      idempotencyKey: "idem-1",
      now: "2026-09-22T00:00:00.000Z",
      lines: [
        {
          clientItemId: "line-1",
          productId: "p1",
          productName: "Paracetamol",
          quantity: "10",
          unitCost: "200",
          sellingPrice: "300",
          batchNumber: "B1",
          expiryDate: "2027-01-01",
        },
      ],
    })
    assert.ok(payload)
    assert.equal(payload?.status, "DRAFT")
    assert.equal(purchaseLocalStatusLabel("DRAFT").includes("not received"), true)

    const restored = parsePersistedPurchaseDraft(JSON.stringify(payload))
    assert.equal(restored?.supplierId, "s1")
    assert.equal(restored?.lines[0]?.sellingPrice, "300")
    assert.equal(restored?.idempotencyKey, "idem-1")
    assert.equal(parsePersistedPurchaseDraft(JSON.stringify({ status: "SYNCED", lines: [] })), null)
  })
})
