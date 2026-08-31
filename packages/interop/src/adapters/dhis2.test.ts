import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createDhis2Adapter } from "./dhis2.ts"
import { createDhis2SimulationAdapter } from "./simulation.ts"

describe("dhis2 adapter", () => {
  it("simulation mode records payloads and never requires a base URL", async () => {
    const adapter = createDhis2Adapter({ mode: "simulation", baseUrl: null })
    const values = [
      { dataElement: "DE_MALARIA_PF", orgUnit: "OU_KLA_01", period: "202608", value: "4" },
    ]
    const push = await adapter.pushDataValueSet(values, "202608", "OU_KLA_01")
    assert.equal(push.ok, true)
    if (!push.ok) return
    assert.equal(push.data.mode, "simulation")
    assert.equal(push.data.importCount, 1)
    assert.equal(adapter.recordedCalls.length, 1)
    assert.equal(adapter.recordedCalls[0]?.method, "pushDataValueSet")
    assert.deepEqual(adapter.recordedCalls[0]?.values, values)

    const health = await adapter.healthCheck()
    assert.equal(health.ok, true)
    assert.equal(health.status, "simulation")
    assert.equal(adapter.recordedCalls.length, 2)
  })

  it("createDhis2SimulationAdapter matches simulation set sibling", async () => {
    const adapter = createDhis2SimulationAdapter()
    assert.equal(adapter.mode, "simulation")
    const push = await adapter.pushDataValueSet(
      [{ dataElement: "DE_TB", orgUnit: "OU_X", period: "202608", value: "1" }],
      "202608",
      "OU_X",
    )
    assert.equal(push.ok, true)
  })

  it("live mode without base URL fails closed", async () => {
    const adapter = createDhis2Adapter({ mode: "live", baseUrl: null })
    const push = await adapter.pushDataValueSet([], "202608", "OU_X")
    assert.equal(push.ok, false)
    if (push.ok) return
    assert.equal(push.code, "NOT_CONFIGURED")
  })
})
