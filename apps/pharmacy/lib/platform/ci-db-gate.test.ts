import { describe, expect, it } from "vitest"
import { hasDb } from "./test-db-guard"

/** Non-skippable gate: SKIPPED != PASS in CI for integration evidence. */
describe("database test prerequisites (P0-004 / connected care spine)", () => {
  it("CI must configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {
    if (process.env.CI === "true") {
      expect(hasDb).toBe(true)
    }
  })
})
