/**
 * Upload safety for pharmacy imports (bulk inventory upload + import sessions).
 * Limits match the Tally migration adapters in @synapse/db (25 MB / 10k rows).
 * Every check runs BEFORE any parser touches the bytes.
 */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
export const MAX_IMPORT_ROWS = 10_000
export const MAX_JSON_DEPTH = 20

export type ImportKind = "csv" | "xlsx" | "xls" | "json"

export class ImportRejected extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415) {
    super(message)
    this.name = "ImportRejected"
  }
}

const KIND_BY_EXT: Record<string, ImportKind> = {
  ".csv": "csv",
  ".txt": "csv",
  ".xlsx": "xlsx",
  ".xls": "xls",
  ".json": "json",
}

/** Browsers send these; empty / octet-stream are tolerated and decided by magic bytes. */
const MIME_BY_KIND: Record<ImportKind, string[]> = {
  csv: ["text/csv", "text/plain", "application/csv", "text/x-csv", "application/vnd.ms-excel", "text/comma-separated-values"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-zip-compressed"],
  xls: ["application/vnd.ms-excel", "application/x-ole-storage", "application/msexcel"],
  json: ["application/json", "text/json", "text/plain"],
}
const NEUTRAL_MIME = new Set(["", "application/octet-stream"])

export type UploadLike = { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }

export async function checkImportFile(
  file: UploadLike,
  allowed: readonly ImportKind[],
): Promise<{ kind: ImportKind; bytes: Uint8Array }> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportRejected(`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB`, 413)
  }
  if (file.size === 0) throw new ImportRejected("File is empty", 400)
  const lower = file.name.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf("."))
  const kind = KIND_BY_EXT[ext]
  if (!kind || !allowed.includes(kind)) {
    throw new ImportRejected(`Unsupported file type. Allowed: ${allowed.join(", ")}`, 415)
  }
  const mime = (file.type ?? "").toLowerCase().split(";")[0].trim()
  if (!NEUTRAL_MIME.has(mime) && !MIME_BY_KIND[kind].includes(mime)) {
    throw new ImportRejected(`File content type ${mime} does not match .${kind}`, 415)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new ImportRejected(`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB`, 413)
  }
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  if (kind === "xlsx" && !isZip) throw new ImportRejected("File is not a valid .xlsx workbook", 415)
  if (kind === "xls" && !isOle && !isZip) throw new ImportRejected("File is not a valid .xls workbook", 415)
  if (kind === "csv" || kind === "json") {
    const head = bytes.subarray(0, 8192)
    if (isZip || isOle || head.includes(0)) {
      throw new ImportRejected(`File is binary, not ${kind.toUpperCase()} text`, 415)
    }
  }
  return { kind, bytes }
}

/** Cheap pre-parse line count so a 10k-row cap is enforced before CSV parsing. */
export function assertCsvRowCap(text: string, maxRows = MAX_IMPORT_ROWS): void {
  let lines = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      lines += 1
      // header + maxRows data rows + one trailing newline
      if (lines > maxRows + 1) throw new ImportRejected(`File has more than ${maxRows} rows`, 413)
    }
  }
}

export function assertRowCap(count: number, maxRows = MAX_IMPORT_ROWS): void {
  if (count > maxRows) throw new ImportRejected(`File has more than ${maxRows} rows`, 413)
}

/** Structural depth scan (string-aware) so hostile nesting is rejected before JSON.parse. */
export function assertJsonDepth(text: string, maxDepth = MAX_JSON_DEPTH): void {
  let depth = 0
  let inString = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (inString) {
      if (c === "\\") i += 1
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === "{" || c === "[") {
      depth += 1
      if (depth > maxDepth) throw new ImportRejected(`JSON nesting deeper than ${maxDepth}`, 400)
    } else if (c === "}" || c === "]") depth -= 1
  }
}

export function parseJsonSafely(text: string): unknown {
  assertJsonDepth(text)
  try {
    return JSON.parse(text, (key, value) => (key === "__proto__" || key === "constructor" || key === "prototype" ? undefined : value))
  } catch {
    throw new ImportRejected("Invalid JSON", 400)
  }
}

const FORMULA_LEAD = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^[+-]?(\d+([.,]\d+)*|\d*\.\d+)$/

/**
 * Neutralise spreadsheet formula injection (`= + - @`, tab, CR) by prefixing a quote.
 * Plain signed numbers ("-5", "+256") are left untouched so quantities still parse.
 */
export function neutralizeFormula(value: string): string {
  if (!value || !FORMULA_LEAD.test(value)) return value
  if (PLAIN_NUMBER.test(value.trim())) return value
  return `'${value}`
}

export function neutralizeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue
    out[neutralizeFormula(String(k))] = typeof v === "string" ? neutralizeFormula(v) : v
  }
  return out as T
}

/** SheetJS read options: no formulas or HTML materialised; parse at most cap+1 rows. */
export const SAFE_XLSX_READ_OPTS = {
  type: "array" as const,
  cellFormula: false,
  cellHTML: false,
  cellStyles: false,
  bookVBA: false,
  sheetRows: MAX_IMPORT_ROWS + 2,
}

export function importErrorResponse(error: unknown): { status: number; body: { error: string } } | null {
  if (error instanceof ImportRejected) return { status: error.status, body: { error: error.message } }
  return null
}
