import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  astmChecksum,
  buildAstmCbcSimulatorMessage,
  buildHl7ChemistrySimulatorMessage,
  genericAstmParser,
  genericCsvParser,
  genericHl7Parser,
  genericRestParser,
  parseAstmResults,
  parseHl7Results,
  validateAstmFrame,
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

  it("rejects ASTM frames with a bad checksum instead of silently accepting them", () => {
    const body = "1H|\\^&|||SYNAPSE"
    const framed = `\u0002${body}\u0003FF\r`
    assert.equal(validateAstmFrame(framed).ok, false)
    assert.throws(() => genericAstmParser.parse(framed), /ASTM_CHECKSUM_INVALID/)
    const good = `\u0002${body}\u0003${astmChecksum(`${body}\u0003`)}\r`
    assert.equal(validateAstmFrame(good).ok, true)
  })

  it("rejects invalid HL7 payloads that are not ORU-style messages", () => {
    assert.equal(genericHl7Parser.canParse("not-hl7"), false)
    assert.throws(() => genericHl7Parser.parse("\u000bNOPE\u001c\r"), /HL7_FRAME_INVALID/)
  })

  it("parses generic CSV and REST observation rows without releasing them", () => {
    const csv = genericCsvParser.parse("accession,code,value,unit\nLAB-1,WBC,6.8,10*9/L")
    assert.equal(csv[0]?.analyzerCode, "WBC")
    const rest = genericRestParser.parse(JSON.stringify({ accessionNumber: "LAB-1", analyzerCode: "HGB", value: "13.4", unit: "g/dL" }))
    assert.equal(rest[0]?.value, "13.4")
  })
})