import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "a11y.tsx"), "utf8")

describe("a11y primitives source contracts", () => {
  it("SkipLink defaults to #main and skip copy", () => {
    assert.match(src, /href = "#main"/)
    assert.match(src, /Skip to main content/)
    assert.match(src, /focus:not-sr-only/)
  })

  it("Field wires label, required, and role=alert errors", () => {
    assert.match(src, /htmlFor=\{id\}/)
    assert.match(src, /role="alert"/)
    assert.match(src, /aria-invalid/)
  })
})
