import { neutralizeFormula } from "./import-guard"

/**
 * One CSV cell for an export: formula-looking text (= + - @ tab CR) gets a leading
 * quote so Excel/Sheets never execute it, then RFC 4180 quoting when needed.
 * Plain numbers (including negatives) are emitted unchanged.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number" || typeof value === "bigint") return String(value)
  const safe = neutralizeFormula(String(value))
  return /[",\r\n]/.test(safe) || safe !== String(value) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",")
}
