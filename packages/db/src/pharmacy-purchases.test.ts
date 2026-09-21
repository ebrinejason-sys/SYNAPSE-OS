import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DUPLICATE_PRODUCT_THRESHOLD,
  derivePaymentStatus,
  findDuplicateProducts,
  generatePurchaseNo,
  isPurchasePaymentStatus,
  lineTotal,
  mapPoStatusToExisting,
  poStatusFromReceived,
  purchaseMargin,
  purchaseTotals,
  rankProductMatches,
  receivePharmacyPurchase,
  scoreProductMatch,
} from "./pharmacy-purchases.ts"

describe("pharmacy purchases domain", () => {
  it("derives supplier payment status without mixing POS payments", () => {
    assert.equal(derivePaymentStatus({ total: 2_000_000, amountPaid: 0 }), "UNPAID")
    assert.equal(derivePaymentStatus({ total: 2_000_000, amountPaid: 800_000 }), "PARTIAL")
    assert.equal(derivePaymentStatus({ total: 2_000_000, amountPaid: 2_000_000 }), "PAID")
    assert.equal(derivePaymentStatus({ total: 2_000_000, amountPaid: 0, explicit: "CREDIT" }), "CREDIT")
    assert.equal(isPurchasePaymentStatus("PAID"), true)
    assert.equal(isPurchasePaymentStatus("captured"), false)
  })

  it("calculates line and purchase totals without hardcoded tax rules", () => {
    assert.equal(lineTotal(500, 200), 100_000)
    const totals = purchaseTotals({
      lines: [
        { quantity: 500, unitCost: 200 },
        { quantity: 200, unitCost: 350 },
      ],
      tax: 0,
      discount: 5_000,
      otherCost: 1_000,
    })
    assert.equal(totals.subtotal, 170_000)
    assert.equal(totals.grandTotal, 166_000)
  })

  it("exposes advisory margin math", () => {
    const margin = purchaseMargin(200, 300)
    assert.equal(margin.profit, 100)
    assert.equal(margin.marginPct, 33.33)
    assert.equal(margin.markupPct, 50)
  })

  it("matches existing catalog products and warns on similar new products", () => {
    const catalog = [
      {
        id: "para",
        name: "Paracetamol 500 mg Tablets",
        genericName: "Paracetamol",
        sku: "PARA-500",
        barcode: "1234567890123",
        strength: "500 mg",
        dosageForm: "Tablet",
        manufacturer: "Cipla",
      },
      {
        id: "amox",
        name: "Amoxicillin 500 mg Capsules",
        genericName: "Amoxicillin",
        sku: "AMOX-500",
        strength: "500 mg",
        dosageForm: "Capsule",
      },
    ]
    const barcodeHit = rankProductMatches({ barcode: "1234567890123" }, catalog)
    assert.equal(barcodeHit[0]?.id, "para")
    assert.ok((barcodeHit[0]?.score ?? 0) >= 100)

    const nameHit = rankProductMatches({ q: "paracetamol 500" }, catalog)
    assert.equal(nameHit[0]?.id, "para")

    const dupes = findDuplicateProducts({ name: "Paracetamol 500 mg Tablets", strength: "500 mg" }, catalog)
    assert.ok(dupes.length >= 1)
    assert.ok((dupes[0]?.score ?? 0) >= DUPLICATE_PRODUCT_THRESHOLD)
    assert.ok(scoreProductMatch({ q: "cetirizine" }, catalog[0]!) < DUPLICATE_PRODUCT_THRESHOLD)
  })

  it("maps partial PO receiving onto existing status values", () => {
    assert.equal(poStatusFromReceived(1000, 0), "ORDERED")
    assert.equal(poStatusFromReceived(1000, 600), "PARTIALLY_RECEIVED")
    assert.equal(poStatusFromReceived(1000, 1000), "RECEIVED")
    assert.equal(mapPoStatusToExisting("ORDERED"), "SENT")
  })

  it("generates purchase numbers distinct from POS receipts", () => {
    assert.match(generatePurchaseNo(1_700_000_000_000), /^PUR-[A-Z0-9]+-[A-Z0-9]+$/)
  })

  it("replays the same idempotency key without a second receive", async () => {
    const prior = {
      ok: true,
      purchaseId: "p1",
      purchaseNo: "PUR-1",
      status: "RECEIVED",
      paymentStatus: "UNPAID",
      grandTotal: 100,
      amountPaid: 0,
      balance: 100,
      received: [{ productId: "prod", batchId: "b1", quantity: 10, purchaseItemId: "i1" }],
    }
    let rpcCalls = 0
    const client = {
      rpc: async () => {
        rpcCalls += 1
        return { data: { batch_id: "b1", product_id: "prod", received: 10 }, error: null }
      },
      from: (table: string) => {
        const api: Record<string, unknown> = {}
        const self = () => api
        for (const m of ["select", "insert", "update", "delete", "eq", "upsert"]) api[m] = self
        api.maybeSingle = async () =>
          table === "pharmacy_purchase_idempotency"
            ? { data: { purchase_id: "p1", response: prior }, error: null }
            : { data: null, error: null }
        api.single = async () => ({ data: prior, error: null })
        return api
      },
    }
    const result = await receivePharmacyPurchase(client as never, {
      tenantId: "t1",
      actorId: "u1",
      supplierId: "s1",
      idempotencyKey: "retry-1",
      lines: [
        {
          productId: "prod",
          productName: "Paracetamol",
          quantity: 10,
          unitCost: 10,
          batchNumber: "PAR-01",
          expiryDate: "2027-01-01",
        },
      ],
    })
    assert.equal("ok" in result && result.ok, true)
    if ("ok" in result && result.ok) {
      assert.equal(result.replay, true)
      assert.equal(result.purchaseId, "p1")
    }
    assert.equal(rpcCalls, 0)
  })

  it("resumes an in-progress receipt without receiving already-applied lines again", async () => {
    let rpcCalls = 0
    const client = {
      rpc: async () => {
        rpcCalls += 1
        return { data: { batch_id: "b2", product_id: "cet", received: 200 }, error: null }
      },
      from: (table: string) => {
        const api: Record<string, unknown> = {}
        const self = () => api
        for (const m of ["select", "insert", "update", "delete", "eq", "upsert"]) api[m] = self
        api.maybeSingle = async () => {
          if (table === "pharmacy_purchase_idempotency") {
            return {
              data: {
                purchase_id: "p2",
                response: { ok: false, purchaseId: "p2", purchaseNo: "PUR-2" },
              },
              error: null,
            }
          }
          if (table === "pharmacy_purchases") {
            return { data: { id: "p2", purchase_no: "PUR-2", status: "PARTIALLY_RECEIVED" }, error: null }
          }
          if (table === "pharmacy_suppliers") {
            return { data: { id: "s1", name: "Supplier A" }, error: null }
          }
          return { data: { id: "b-existing", cost_price: 100 }, error: null }
        }
        api.single = async () => ({ data: { id: "p2", purchase_no: "PUR-2" }, error: null })
        api.then = undefined
        if (table === "pharmacy_purchase_items") {
          api.select = () => {
            const q: Record<string, unknown> = {}
            const qself = () => q
            for (const m of ["eq"]) q[m] = qself
            q.then = (resolve: (value: unknown) => unknown) =>
              Promise.resolve(
                resolve({
                  data: [
                    {
                      id: "i-para",
                      product_id: "para",
                      quantity: 500,
                      received_quantity: 500,
                      unit_cost: 200,
                      batch_number: "PAR-01",
                      expiry_date: "2027-01-01",
                      selling_price: null,
                      receipt_idempotency_key: "retry-2:para:PAR-01",
                      purchase_order_item_id: null,
                    },
                    {
                      id: "i-cet",
                      product_id: "cet",
                      quantity: 200,
                      received_quantity: 0,
                      unit_cost: 350,
                      batch_number: "CET-44",
                      expiry_date: "2027-06-01",
                      selling_price: null,
                      receipt_idempotency_key: "retry-2:cet:CET-44",
                      purchase_order_item_id: null,
                    },
                  ],
                  error: null,
                }),
              )
            return q
          }
        }
        return api
      },
    }
    const result = await receivePharmacyPurchase(client as never, {
      tenantId: "t1",
      actorId: "u1",
      supplierId: "s1",
      idempotencyKey: "retry-2",
      lines: [
        {
          productId: "para",
          productName: "Paracetamol",
          quantity: 500,
          unitCost: 200,
          batchNumber: "PAR-01",
          expiryDate: "2027-01-01",
        },
        {
          productId: "cet",
          productName: "Cetirizine",
          quantity: 200,
          unitCost: 350,
          batchNumber: "CET-44",
          expiryDate: "2027-06-01",
        },
      ],
    })
    assert.equal("ok" in result && result.ok, true)
    assert.equal(rpcCalls, 1)
  })
})
