import { describe, it, expect } from "vitest";
import {
  buildReceiptSnapshot,
  renderReceiptText,
  renderReceiptHtml,
  isFiscalReceipt,
  type ReceiptSaleInput,
  type ReceiptPharmacy,
} from "@synapse/db/receipt";

const pharmacy: ReceiptPharmacy = {
  legalName: "Care Plus Pharmacy Ltd",
  tradingName: "Care Plus",
  address: "Kampala Rd, Kampala",
  phone: "+256700000000",
  tin: "1000000000",
  ndaLicenseNumber: "NDA-123",
  supervisingPharmacist: "J. Doe",
  pharmacistRegNumber: "PH-999",
  receiptFooter: "Thank you",
  currency: "UGX",
};

const baseSale: ReceiptSaleInput = {
  saleId: "s1",
  receiptNumber: "R-20260806-0001",
  createdAt: "2026-08-06T12:42:00.000Z",
  cashier: "Cashier A",
  paymentMethod: "CASH",
  subtotal: 10000,
  discountTotal: 500,
  taxAmount: 0,
  totalAmount: 9500,
  amountReceived: 10000,
  change: 500,
  lines: [
    {
      name: "Amoxicillin",
      genericName: "Amoxicillin",
      strength: "500mg",
      dosageForm: "Capsule",
      quantity: 10,
      unit: "cap",
      unitPrice: 1000,
      discount: 500,
      batchNumber: "B-1",
      expiryDate: "2027-01-01",
      manufacturer: "Acme",
    },
  ],
};

describe("receipt fiscal rules", () => {
  it("labels a non-EFRIS sale as POS/non-fiscal", () => {
    const snap = buildReceiptSnapshot({ pharmacy, sale: baseSale });
    expect(snap.isFiscal).toBe(false);
    expect(snap.documentLabel).toBe("POS RECEIPT (NON-FISCAL)");
  });

  it("labels fiscal ONLY when EFRIS accepted with a fiscal document number", () => {
    expect(isFiscalReceipt({ status: "accepted", fiscalDocumentNumber: "F-1" })).toBe(true);
    expect(isFiscalReceipt({ status: "accepted" })).toBe(false); // no doc number
    expect(isFiscalReceipt({ status: "pending", fiscalDocumentNumber: "F-1" })).toBe(false);
    expect(isFiscalReceipt({ status: "none" })).toBe(false);

    const snap = buildReceiptSnapshot({
      pharmacy,
      sale: { ...baseSale, efris: { status: "accepted", fiscalDocumentNumber: "F-1", verificationCode: "V-1" } },
    });
    expect(snap.isFiscal).toBe(true);
    expect(snap.documentLabel).toBe("FISCAL RECEIPT");
  });
});

describe("receipt snapshot immutability", () => {
  it("deep-freezes the snapshot so later edits cannot mutate a historical receipt", () => {
    const snap = buildReceiptSnapshot({ pharmacy, sale: baseSale });
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.lines)).toBe(true);
    expect(Object.isFrozen(snap.lines[0])).toBe(true);
    expect(() => {
      // @ts-expect-error runtime immutability check
      snap.totalAmount = 1;
    }).toThrow();
  });

  it("snapshots sale-time line data (batch/expiry/manufacturer)", () => {
    const snap = buildReceiptSnapshot({ pharmacy, sale: baseSale });
    expect(snap.lines[0]).toMatchObject({
      batchNumber: "B-1",
      expiryDate: "2027-01-01",
      manufacturer: "Acme",
      lineTotal: 9500, // 10*1000 - 500
    });
  });
});

describe("receipt rendering", () => {
  it("renders plain text with totals, batch, and a non-fiscal marker", () => {
    const txt = renderReceiptText(buildReceiptSnapshot({ pharmacy, sale: baseSale }));
    expect(txt).toContain("Care Plus");
    expect(txt).toContain("R-20260806-0001");
    expect(txt).toContain("Batch B-1");
    expect(txt).toContain("UGX 9,500");
    expect(txt).toContain("Not an EFRIS fiscal receipt");
  });

  it("adds a REPRINT marker on reprints", () => {
    const txt = renderReceiptText(buildReceiptSnapshot({ pharmacy, sale: baseSale, isReprint: true }));
    expect(txt).toContain("REPRINT");
    const html = renderReceiptHtml(buildReceiptSnapshot({ pharmacy, sale: baseSale, isReprint: true }));
    expect(html).toContain("REPRINT");
  });

  it("renders self-contained HTML and escapes user content", () => {
    const html = renderReceiptHtml(
      buildReceiptSnapshot({
        pharmacy: { ...pharmacy, tradingName: "A & B <Pharmacy>" },
        sale: baseSale,
      }),
    );
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("A &amp; B &lt;Pharmacy&gt;");
    expect(html).toContain("TOTAL");
  });

  it("shows a voided/refunded watermark and status", () => {
    const snap = buildReceiptSnapshot({ pharmacy, sale: { ...baseSale, status: "refunded" } });
    expect(renderReceiptText(snap)).toContain("REFUNDED");
    expect(renderReceiptHtml(snap)).toContain("REFUNDED");
  });
});
