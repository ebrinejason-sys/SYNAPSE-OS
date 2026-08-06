import { describe, it, expect } from "vitest";
import {
  summarizeInventory,
  allocateFefo,
  allocatedQuantity,
  buildStockError,
  isSellableBatch,
  normaliseBatch,
} from "@synapse/db/inventory";
import { validateImportRow, validateImportRows } from "@synapse/db/import-validation";

const TODAY = "2026-08-05";
const FUTURE = "2027-01-01";
const SOON = "2026-09-01";
const PAST = "2026-07-01";

describe("summarizeInventory", () => {
  it("reports product-level stock with NO batches as unbatched and NOT sellable", () => {
    const s = summarizeInventory({ id: "p1", name: "Amoxicillin", quantity: 40 }, [], TODAY);
    expect(s.physicalQuantity).toBe(0);
    expect(s.sellableQuantity).toBe(0);
    expect(s.unbatchedQuantity).toBe(40);
    expect(s.hasBatches).toBe(false);
    expect(s.hasPhantomStock).toBe(true);
  });

  it("excludes expired batches from sellable but counts them physically", () => {
    const s = summarizeInventory({ id: "p1", name: "Amox", quantity: 30 }, [
      { id: "b1", quantity: 30, expiry_date: PAST, is_active: true },
    ], TODAY);
    expect(s.physicalQuantity).toBe(30);
    expect(s.sellableQuantity).toBe(0);
    expect(s.expiredQuantity).toBe(30);
    expect(s.hasPhantomStock).toBe(true);
  });

  it("counts only valid batches in a mix of expired and valid", () => {
    const s = summarizeInventory({ id: "p1", name: "Amox", quantity: 50 }, [
      { id: "b1", quantity: 20, expiry_date: PAST, is_active: true },
      { id: "b2", quantity: 30, expiry_date: FUTURE, is_active: true },
    ], TODAY);
    expect(s.physicalQuantity).toBe(50);
    expect(s.sellableQuantity).toBe(30);
    expect(s.expiredQuantity).toBe(20);
  });

  it("separates quarantined and damaged stock from sellable", () => {
    const s = summarizeInventory({ id: "p1", name: "X", quantity: 60 }, [
      { id: "b1", quantity: 10, expiry_date: FUTURE, status: "quarantined" },
      { id: "b2", quantity: 15, expiry_date: FUTURE, status: "damaged" },
      { id: "b3", quantity: 25, expiry_date: FUTURE, status: "recalled" },
      { id: "b4", quantity: 10, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    expect(s.sellableQuantity).toBe(10);
    expect(s.quarantinedQuantity).toBe(10);
    expect(s.damagedQuantity).toBe(15);
    expect(s.physicalQuantity).toBe(60);
  });

  it("treats missing status as active (forward-compatible with pre-status DBs)", () => {
    const b = normaliseBatch({ id: "b", quantity: 5, expiry_date: FUTURE }, TODAY);
    expect(b.status).toBe("active");
    expect(isSellableBatch(b, TODAY)).toBe(true);
  });

  it("reflects a stock adjustment (reduced batch qty) in sellable", () => {
    const before = summarizeInventory({ id: "p", name: "X", quantity: 20 }, [
      { id: "b1", quantity: 20, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    const after = summarizeInventory({ id: "p", name: "X", quantity: 12 }, [
      { id: "b1", quantity: 12, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    expect(before.sellableQuantity).toBe(20);
    expect(after.sellableQuantity).toBe(12);
    expect(after.unbatchedQuantity).toBe(0);
  });

  it("reflects receiving new valid stock (batch added) as sellable", () => {
    const before = summarizeInventory({ id: "p", name: "X", quantity: 0 }, [], TODAY);
    const afterReceive = summarizeInventory({ id: "p", name: "X", quantity: 25 }, [
      { id: "b-new", batch_number: "GRN-1", quantity: 25, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    expect(before.sellableQuantity).toBe(0);
    expect(afterReceive.sellableQuantity).toBe(25);
    expect(afterReceive.hasPhantomStock).toBe(false);
  });

  it("reflects a refund/void (batch qty restored) increasing sellable", () => {
    const afterSale = summarizeInventory({ id: "p", name: "X", quantity: 5 }, [
      { id: "b1", quantity: 5, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    const afterRefund = summarizeInventory({ id: "p", name: "X", quantity: 8 }, [
      { id: "b1", quantity: 8, expiry_date: FUTURE, status: "active" },
    ], TODAY);
    expect(afterSale.sellableQuantity).toBe(5);
    expect(afterRefund.sellableQuantity).toBe(8);
  });
});

describe("allocateFefo", () => {
  it("splits an allocation across batches earliest-expiry first", () => {
    const alloc = allocateFefo(
      [
        { id: "late", quantity: 5, expiry_date: FUTURE, status: "active" },
        { id: "soon", quantity: 3, expiry_date: SOON, status: "active" },
      ],
      6,
      { today: TODAY },
    );
    expect(alloc.map((a) => a.batchId)).toEqual(["soon", "late"]);
    expect(alloc[0].quantity).toBe(3);
    expect(alloc[1].quantity).toBe(3);
    expect(allocatedQuantity(alloc)).toBe(6);
  });

  it("skips expired and quarantined batches", () => {
    const alloc = allocateFefo(
      [
        { id: "exp", quantity: 100, expiry_date: PAST, status: "active" },
        { id: "quar", quantity: 100, expiry_date: FUTURE, status: "quarantined" },
        { id: "ok", quantity: 4, expiry_date: FUTURE, status: "active" },
      ],
      10,
      { today: TODAY },
    );
    expect(alloc.map((a) => a.batchId)).toEqual(["ok"]);
    expect(allocatedQuantity(alloc)).toBe(4); // partial: only 4 sellable
  });

  it("models two cashiers racing for the last units (deterministic winner takes first)", () => {
    const batches = [{ id: "b1", quantity: 5, expiry_date: FUTURE, status: "active" as const }];
    // Cashier A commits first for 4, then B tries 4 against remaining 1.
    const a = allocateFefo(batches, 4, { today: TODAY });
    expect(allocatedQuantity(a)).toBe(4);
    const remaining = [{ id: "b1", quantity: 1, expiry_date: FUTURE, status: "active" as const }];
    const b = allocateFefo(remaining, 4, { today: TODAY });
    expect(allocatedQuantity(b)).toBe(1); // B only gets the leftover; RPC would then raise INSUFFICIENT_STOCK
  });

  it("honours a manual batch override (pin)", () => {
    const alloc = allocateFefo(
      [
        { id: "soon", quantity: 3, expiry_date: SOON, status: "active" },
        { id: "late", quantity: 5, expiry_date: FUTURE, status: "active" },
      ],
      2,
      { today: TODAY, pinBatchId: "late" },
    );
    expect(alloc).toHaveLength(1);
    expect(alloc[0].batchId).toBe("late");
  });
});

describe("buildStockError (structured POS contract)", () => {
  it("returns null when fully sellable", () => {
    const err = buildStockError({
      product: { id: "p", name: "X" },
      batches: [{ id: "b", quantity: 10, expiry_date: FUTURE, status: "active" }],
      requestedQuantity: 3,
      today: TODAY,
    });
    expect(err).toBeNull();
  });

  it("flags UNBATCHED_STOCK when product shows stock but no batches", () => {
    const err = buildStockError({
      product: { id: "p", name: "Amoxicillin", quantity: 40 },
      batches: [],
      requestedQuantity: 2,
      today: TODAY,
    })!;
    expect(err.reasonCode).toBe("UNBATCHED_STOCK");
    expect(err.sellableQuantity).toBe(0);
    expect(err.productName).toBe("Amoxicillin");
    expect(err.recommendedAction).toMatch(/genuine batch/i);
  });

  it("flags EXPIRED_ONLY when all batches are expired", () => {
    const err = buildStockError({
      product: { id: "p", name: "X", quantity: 5 },
      batches: [{ id: "b", quantity: 5, expiry_date: PAST, status: "active" }],
      requestedQuantity: 1,
      today: TODAY,
    })!;
    expect(err.reasonCode).toBe("EXPIRED_ONLY");
  });

  it("flags QUARANTINED_ONLY when all stock is held", () => {
    const err = buildStockError({
      product: { id: "p", name: "X", quantity: 5 },
      batches: [{ id: "b", quantity: 5, expiry_date: FUTURE, status: "quarantined" }],
      requestedQuantity: 1,
      today: TODAY,
    })!;
    expect(err.reasonCode).toBe("QUARANTINED_ONLY");
  });

  it("flags INSUFFICIENT_STOCK with the sellable count when partly short", () => {
    const err = buildStockError({
      product: { id: "p", name: "X", quantity: 3 },
      batches: [{ id: "b", quantity: 3, expiry_date: FUTURE, status: "active" }],
      requestedQuantity: 10,
      today: TODAY,
    })!;
    expect(err.reasonCode).toBe("INSUFFICIENT_STOCK");
    expect(err.sellableQuantity).toBe(3);
    expect(err.requestedQuantity).toBe(10);
    expect(err.recommendedAction).toMatch(/Reduce the quantity to 3/);
  });

  it("flags PRODUCT_INACTIVE", () => {
    const err = buildStockError({
      product: { id: "p", name: "X", quantity: 10, is_active: false },
      batches: [{ id: "b", quantity: 10, expiry_date: FUTURE, status: "active" }],
      requestedQuantity: 1,
      today: TODAY,
    })!;
    expect(err.reasonCode).toBe("PRODUCT_INACTIVE");
  });
});

describe("import validation (batch number, quantity, expiry)", () => {
  it("accepts a complete valid batch row as sellable", () => {
    const r = validateImportRow(
      { name: "Amox", price: 500, quantity: 20, batchNumber: "B-1", expiryDate: FUTURE },
      2,
      { today: TODAY, requireBatchForStock: true },
    );
    expect(r.ok).toBe(true);
    expect(r.batch).toEqual({ batchNumber: "B-1", quantity: 20, expiryDate: FUTURE });
  });

  it("rejects positive stock with a past expiry when batch is required", () => {
    const r = validateImportRow(
      { name: "Amox", price: 500, quantity: 20, batchNumber: "B-1", expiryDate: PAST },
      2,
      { today: TODAY, requireBatchForStock: true },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/in the past/);
  });

  it("rejects positive stock with no batch number when batch is required", () => {
    const r = validateImportRow(
      { name: "Amox", price: 500, quantity: 20, expiryDate: FUTURE },
      2,
      { today: TODAY, requireBatchForStock: true },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/batch number/i);
  });

  it("downgrades incomplete stock to non-sellable (warning) when not requiring batches", () => {
    const r = validateImportRow(
      { name: "Amox", price: 500, quantity: 20 },
      2,
      { today: TODAY, requireBatchForStock: false },
    );
    expect(r.productOk).toBe(true);
    expect(r.batch).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/non-sellable/i);
  });

  it("requires a positive price or cost", () => {
    const r = validateImportRow({ name: "Amox", quantity: 0 }, 2, { today: TODAY });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/price or cost/);
  });

  it("summarises a mixed import batch", () => {
    const report = validateImportRows(
      [
        { name: "A", price: 100, quantity: 10, batchNumber: "BA", expiryDate: FUTURE },
        { name: "B", price: 100, quantity: 5, expiryDate: PAST, batchNumber: "BB" },
        { name: "", price: 0 },
      ],
      { today: TODAY, requireBatchForStock: true },
    );
    expect(report.totalRows).toBe(3);
    expect(report.sellableBatches).toBe(1);
    expect(report.rejectedRows).toBe(2);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
