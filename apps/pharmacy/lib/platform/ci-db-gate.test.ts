import { describe, expect, it } from "vitest"
import { hasPartialDbConfig } from "./test-db-guard"

/** Non-skippable gate: CI must not partially configure DB-backed integration tests. */
describe("database test prerequisites (P0-004 / connected care spine)", () => {
  it("CI must provide either both DB vars or neither", () => {
    if (process.env.CI === "true") {
      expect(hasPartialDbConfig).toBe(false)
    }
  })
})
