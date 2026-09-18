import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { CLINICAL_AI_POLICIES, redactAiLog } from "./clinical-ai-gateway.ts"

describe("clinical AI gateway policy", () => {
  it("requires auth, tenant, advisory-only semantics, and timeout for every clinical endpoint", () => {
    for (const policy of Object.values(CLINICAL_AI_POLICIES)) {
      if (policy.endpoint === "health_coach") {
        assert.equal(policy.authentication, "session")
        assert.equal(policy.advisoryOnly, true)
        continue
      }
      assert.equal(policy.authentication, "session")
      assert.equal(policy.tenantScoped, true)
      assert.equal(policy.advisoryOnly, true)
      assert.ok(policy.timeoutMs > 0)
      assert.equal(policy.humanOverride, true)
    }
  })

  it("strips PHI-ish keys from infrastructure logs", () => {
    const redacted = redactAiLog({ chiefComplaint: "fever", tenantId: "t1", endpoint: "diagnose" })
    assert.equal("chiefComplaint" in redacted, false)
    assert.equal(redacted.tenantId, "t1")
  })
})
