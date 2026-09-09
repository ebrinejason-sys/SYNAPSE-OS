import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAstmCbcSimulatorMessage,
  buildHl7ChemistrySimulatorMessage,
  parseAstmResults,
  parseHl7Results,
} from "./index.ts"

describe("Lab Edge protocol foundation", () => {
  it("parses synthetic ASTM CBC results by accession", () => {
    const results = parseAstmResults(buildAstmCbcSimulatorMessage("LAB-20260904-000123"), "raw-astm")
    assert.deepEqual(results.map((result) => [result.analyzerCode, result.value, result.unit]), [
      ["WBC", "6.8", "10*9/L"],
      ["HGB", "13.4", "g/dL"],
    ])
    assert.ok(results.every((result) => result.accessionNumber === "LAB-20260904-000123"))
    assert.ok(results.every((result) => result.rawMessageRef === "raw-astm"))
  })

  it("parses synthetic HL7 chemistry results without releasing them", () => {
    const results = parseHl7Results(buildHl7ChemistrySimulatorMessage("LAB-20260904-000124"), "raw-hl7")
    assert.deepEqual(results.map((result) => result.analyzerCode), ["2345-7", "2160-0"])
    assert.deepEqual(results.map((result) => result.value), ["5.2", "82"])
    assert.ok(results.every((result) => result.accessionNumber === "LAB-20260904-000124"))
  })
})