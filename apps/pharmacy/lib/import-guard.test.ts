import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import {
  assertCsvRowCap,
  assertJsonDepth,
  checkImportFile,
  ImportRejected,
  MAX_IMPORT_BYTES,
  neutralizeFormula,
  neutralizeRow,
  parseJsonSafely,
  SAFE_XLSX_READ_OPTS,
} from "./import-guard"

const file = (name: string, type: string, body: Uint8Array | string, size?: number) => {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body
  return { name, type, size: size ?? bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer }
}
const rejects = async (p: Promise<unknown>, status: number) => {
  await expect(p).rejects.toBeInstanceOf(ImportRejected)
  await p.catch((e: ImportRejected) => expect(e.status).toBe(status))
}

describe("checkImportFile", () => {
  it("accepts a normal CSV", async () => {
    const r = await checkImportFile(file("stock.csv", "text/csv", "name,qty\nA,1\n"), ["csv"])
    expect(r.kind).toBe("csv")
  })
  it("rejects oversize before reading the body (413)", async () => {
    await rejects(checkImportFile(file("big.csv", "text/csv", "x", MAX_IMPORT_BYTES + 1), ["csv"]), 413)
  })
  it("rejects a wrong extension (415)", async () => {
    await rejects(checkImportFile(file("evil.exe", "application/octet-stream", "MZ"), ["csv", "xlsx"]), 415)
  })
  it("rejects a MIME that contradicts the extension (415)", async () => {
    await rejects(checkImportFile(file("stock.csv", "image/png", "name\nA\n"), ["csv"]), 415)
    await rejects(checkImportFile(file("stock.csv", "text/html", "<script>"), ["csv"]), 415)
  })
  it("rejects a renamed binary posing as .xlsx or .csv (415)", async () => {
    await rejects(checkImportFile(file("stock.xlsx", "", "name,qty\nA,1"), ["xlsx"]), 415)
    await rejects(checkImportFile(file("stock.csv", "text/csv", new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), ["csv"]), 415)
  })
  it("rejects JSON where only CSV/XLSX are allowed", async () => {
    await rejects(checkImportFile(file("x.json", "application/json", "[]"), ["csv", "xlsx", "xls"]), 415)
  })
})

describe("row caps", () => {
  it("rejects a CSV with more than 10k data rows before parsing", () => {
    const text = "name\n" + "A\n".repeat(10_001)
    expect(() => assertCsvRowCap(text)).toThrow(ImportRejected)
    expect(() => assertCsvRowCap("name\n" + "A\n".repeat(10_000))).not.toThrow()
  })
  it("SheetJS parses at most cap+2 rows of a huge sheet", () => {
    const ws = XLSX.utils.aoa_to_sheet([["name"], ...Array.from({ length: 10_050 }, (_, i) => [`P${i}`])])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "S")
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const read = XLSX.read(new Uint8Array(buf), SAFE_XLSX_READ_OPTS)
    const rows = XLSX.utils.sheet_to_json(read.Sheets.S)
    expect(rows.length).toBe(10_001)
  })
})

describe("JSON", () => {
  it("rejects deep nesting before JSON.parse", () => {
    const deep = "[".repeat(5000) + "]".repeat(5000)
    expect(() => assertJsonDepth(deep)).toThrow(ImportRejected)
    expect(() => parseJsonSafely(deep)).toThrow(ImportRejected)
  })
  it("ignores brackets inside strings", () => {
    expect(() => assertJsonDepth(JSON.stringify({ a: "[[[[[[[[[[[[[[[[[[[[[[[[[[" }))).not.toThrow()
  })
  it("drops __proto__ keys", () => {
    const v = parseJsonSafely('{"__proto__":{"polluted":1},"rows":[]}') as Record<string, unknown>
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(v, "__proto__")).toBe(false)
  })
})

describe("formula neutralisation", () => {
  it.each(["=HYPERLINK(\"http://x\",\"y\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\t=1", "\r=1"])("%s gets a quote prefix", (v) => {
    expect(neutralizeFormula(v)).toBe(`'${v}`)
  })
  it.each(["-5", "+256700000000", "12.5", "Paracetamol", ""])("%s is left alone", (v) => {
    expect(neutralizeFormula(v)).toBe(v)
  })
  it("neutralises keys and values in a parsed row", () => {
    expect(neutralizeRow({ name: "=EVIL()", qty: "-3", "=h": "x" })).toEqual({ name: "'=EVIL()", qty: "-3", "'=h": "x" })
  })
  it("SafeXLSX options never surface formulas", () => {
    const ws: XLSX.WorkSheet = { "!ref": "A1:A2", A1: { t: "s", v: "name" }, A2: { t: "s", v: "x", f: 'HYPERLINK("http://evil","x")' } }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "S")
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const read = XLSX.read(new Uint8Array(buf), SAFE_XLSX_READ_OPTS)
    expect(read.Sheets.S.A2.f).toBeUndefined()
  })
})
