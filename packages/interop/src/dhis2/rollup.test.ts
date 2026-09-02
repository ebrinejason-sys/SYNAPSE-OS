import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { monthPeriodFromIso, rollupDiagnosesToFacts } from "./rollup.ts"

describe("dhis2 rollup", () => {
  it("rolls up verified stems into monthly facts", () => {
    const facts = rollupDiagnosesToFacts(
      [
        { stem_code: "1F40" },
        { stem_code: "1F40" },
        { stem_code: "CA40" },
        { stem_code: "ZZZZ" },
      ],
      { localOrgKey: "facility-01", period: "202608" },
    )
    assert.deepEqual(facts, [
      { localOrgKey: "facility-01", period: "202608", icd11StemCode: "1F40", count: 2 },
      { localOrgKey: "facility-01", period: "202608", icd11StemCode: "CA40", count: 1 },
    ])
  })

  it("derives YYYYMM period from ISO timestamp", () => {
    assert.equal(monthPeriodFromIso("2026-08-15T10:00:00.000Z"), "202608")
    assert.equal(monthPeriodFromIso("2026-01-02T00:00:00.000Z"), "202601")
  })
})
