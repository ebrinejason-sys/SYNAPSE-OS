// SheetJS audit: every workspace must use the patched SheetJS build (0.20.3 from the
// official CDN; the npm registry "xlsx" stops at 0.18.5, which has known
// prototype-pollution / ReDoS advisories). Also checks the apps/app import still works.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"

function manifests() {
  const out = [join(ROOT, "package.json")]
  for (const dir of ["apps", "packages"]) {
    for (const name of readdirSync(join(ROOT, dir))) {
      const p = join(ROOT, dir, name, "package.json")
      if (existsSync(p)) out.push(p)
    }
  }
  return out
}

test("every manifest that depends on xlsx pins the SheetJS 0.20.3 CDN build", () => {
  const users = []
  for (const p of manifests()) {
    const pkg = JSON.parse(readFileSync(p, "utf8"))
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const v = pkg[field]?.xlsx
      if (v) {
        users.push(p)
        assert.equal(v, CDN, `${p} ${field}.xlsx must be ${CDN}, got ${v}`)
      }
    }
  }
  assert.ok(users.length >= 2, "expected apps/app and apps/pharmacy to depend on xlsx")
})

test("lockfile resolves no registry xlsx 0.18.x anywhere (incl. transitive)", () => {
  const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"))
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!/(^|\/)node_modules\/xlsx$/.test(path)) continue
    assert.equal(meta.version, "0.20.3", `${path} is ${meta.version}`)
    assert.equal(meta.resolved, CDN, `${path} resolved from ${meta.resolved}`)
  }
})

test("apps/app's xlsx reads a workbook and converts to CSV (API used by stock-import.tsx)", () => {
  const req = createRequire(join(ROOT, "apps/app/package.json"))
  const XLSX = req("xlsx")
  assert.equal(XLSX.version, "0.20.3")
  const ws = XLSX.utils.aoa_to_sheet([["name", "qty"], ["Paracetamol", 10]])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" })
  const back = XLSX.read(b64, { type: "base64" })
  assert.equal(XLSX.utils.sheet_to_csv(back.Sheets[back.SheetNames[0]]).trim(), "name,qty\nParacetamol,10")
})
