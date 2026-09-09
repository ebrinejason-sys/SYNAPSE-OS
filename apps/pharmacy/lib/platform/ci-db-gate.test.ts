import { describe, expect, it } from "vitest"
import { hasDb, hasPartialDbConfig } from "./test-db-guard"

/** Non-skippable gate: CI must not partially configure DB-backed integration tests. */
describe("database test prerequisites (P0-004 / connected care spine)", () => {
  it("must provide either both DB vars or neither", () => {
    expect(hasPartialDbConfig).toBe(false)
    if (process.env.CI === "true") {
      expect(hasDb).toBe(true)
    }
  })
})
