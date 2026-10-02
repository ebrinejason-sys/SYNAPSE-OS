import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { csvCell, csvRow } from "./csv"
import { escapeHtml } from "./html"

describe("csvCell (exports)", () => {
  it.each([
    ["=HYPERLINK(\"http://evil\",\"x\")", `"'=HYPERLINK(""http://evil"",""x"")"`],
    ["+cmd|' /C calc'!A0", `"'+cmd|' /C calc'!A0"`],
    ["@SUM(A1:A9)", `"'@SUM(A1:A9)"`],
    ["\t=1", `"'\t=1"`],
    ["-1+1", `"'-1+1"`],
  ])("neutralises %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected)
  })
  it("keeps numbers and plain text, quotes commas/quotes/newlines", () => {
    expect(csvCell(-12.5)).toBe("-12.5")
    expect(csvCell("-12.5")).toBe("-12.5")
    expect(csvCell("Paracetamol 500mg")).toBe("Paracetamol 500mg")
    expect(csvCell('Amoxil, "500"')).toBe('"Amoxil, ""500"""')
    expect(csvCell("a\nb")).toBe('"a\nb"')
    expect(csvCell(null)).toBe("")
    expect(csvRow(["=x", 1, "ok"])).toBe(`"'=x",1,ok`)
  })
  it.each(["app/portal/reports/page.tsx", "app/portal/activity-log/page.tsx"])("%s routes every exported value through csvCell", (f) => {
    const src = readFileSync(join(__dirname, "..", f), "utf8")
    expect(src).toContain('from "@/lib/csv"')
    const csvLines = src.split("\n").filter((l) => l.includes("csvContent +=") && l.includes("${"))
    for (const line of csvLines) expect(line.replace(/\$\{csvCell\([^`]*?\)\}/g, "")).not.toMatch(/\$\{/)
    expect(src).not.toContain('.map(field => `"${field}"`)')
  })
})

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;")
    expect(escapeHtml(null)).toBe("")
  })
})
