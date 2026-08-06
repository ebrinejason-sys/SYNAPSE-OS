/**
 * Pure validation for pharmacy stock imports (CSV / XLSX rows).
 *
 * Enforces the Phase-1 rule: previously-unbatched medicine only becomes sellable
 * when genuine batch information (batch number, positive integer quantity, and a
 * valid non-past expiry date) is supplied. Never fabricates batch numbers or
 * expiry dates — rows lacking that information are imported as non-sellable
 * catalogue entries (quantity 0) or rejected, per the caller's policy.
 */

import { daysUntilExpiry, kampalaToday } from "./inventory";

export interface RawImportRow {
  name?: string | null;
  sku?: string | null;
  price?: number | string | null;
  costPrice?: number | string | null;
  quantity?: number | string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  [key: string]: unknown;
}

export interface ValidatedBatch {
  batchNumber: string;
  quantity: number;
  expiryDate: string; // YYYY-MM-DD
}

export interface ImportRowResult {
  ok: boolean;
  /** Present only when the row carries a complete, valid, sellable batch. */
  batch: ValidatedBatch | null;
  /** True when the row is a valid catalogue product even if no batch was provided. */
  productOk: boolean;
  errors: string[];
  warnings: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Best-effort normalisation of a human-entered date to YYYY-MM-DD. Returns null if unparseable. */
export function normaliseExpiry(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (ISO_DATE.test(s)) return s;
  // Accept DD/MM/YYYY and MM/YYYY and YYYY/MM/DD via Date parsing as a fallback.
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toMoney(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate one import row.
 *
 * @param row            the raw row (already column-mapped to canonical keys)
 * @param rowNumber      1-based row number for error messages
 * @param opts.today     Kampala date override (tests)
 * @param opts.requireBatchForStock  when true, a positive quantity MUST come with a
 *                       complete valid batch, otherwise the row is rejected. When
 *                       false (default), a positive quantity without batch info is
 *                       downgraded to a non-sellable catalogue entry with a warning.
 */
export function validateImportRow(
  row: RawImportRow,
  rowNumber: number,
  opts: { today?: string; requireBatchForStock?: boolean } = {},
): ImportRowResult {
  const today = opts.today ?? kampalaToday();
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = String(row.name ?? "").trim();
  if (!name) errors.push(`Row ${rowNumber}: product name is required`);

  const price = toMoney(row.price);
  const cost = toMoney(row.costPrice);
  if ((price == null || price <= 0) && (cost == null || cost <= 0)) {
    errors.push(`Row ${rowNumber}: "${name || "?"}" needs a positive price or cost`);
  }

  const qty = toInt(row.quantity);
  const batchNumber = String(row.batchNumber ?? "").trim();
  const expiryRaw = row.expiryDate ?? null;
  const expiry = normaliseExpiry(expiryRaw as string | null);

  let batch: ValidatedBatch | null = null;

  const hasAnyBatchField = Boolean(batchNumber) || Boolean(expiryRaw) || (qty != null && qty > 0);

  if (hasAnyBatchField) {
    const batchErrors: string[] = [];
    if (!batchNumber) batchErrors.push("missing batch number");
    if (qty == null || qty <= 0) batchErrors.push("missing/invalid quantity (must be a positive whole number)");
    if (!expiry) {
      batchErrors.push("missing/invalid expiry date");
    } else {
      const days = daysUntilExpiry(expiry, today);
      if (days != null && days < 0) batchErrors.push(`expiry date ${expiry} is in the past`);
    }

    if (batchErrors.length === 0 && qty != null && expiry) {
      batch = { batchNumber, quantity: qty, expiryDate: expiry };
    } else if (opts.requireBatchForStock) {
      errors.push(
        `Row ${rowNumber}: "${name || "?"}" claims stock but batch data is invalid — ${batchErrors.join(", ")}. ` +
          `Provide a genuine batch number, positive quantity and future expiry date.`,
      );
    } else if (qty != null && qty > 0) {
      warnings.push(
        `Row ${rowNumber}: "${name || "?"}" imported as non-sellable (quantity 0) — ${batchErrors.join(", ")}. ` +
          `Receive it with valid batch information to make it sellable.`,
      );
    }
  }

  const productOk = errors.length === 0;
  return {
    ok: productOk,
    batch,
    productOk,
    errors,
    warnings,
  };
}

export interface ImportValidationReport {
  totalRows: number;
  validProducts: number;
  sellableBatches: number;
  rejectedRows: number;
  errors: string[];
  warnings: string[];
  rows: ImportRowResult[];
}

export function validateImportRows(
  rows: RawImportRow[],
  opts: { today?: string; requireBatchForStock?: boolean } = {},
): ImportValidationReport {
  const results = rows.map((r, i) => validateImportRow(r, i + 2, opts)); // +2: header + 1-based
  return {
    totalRows: rows.length,
    validProducts: results.filter((r) => r.productOk).length,
    sellableBatches: results.filter((r) => r.batch).length,
    rejectedRows: results.filter((r) => !r.productOk).length,
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings),
    rows: results,
  };
}
