import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fixtureAggregateFacts } from "@synapse/interop"
import { InMemoryDhis2ExportQueue } from "./dhis2-export.ts"

describe("dhis2-export queue", () => {
  it("enqueues and processes a simulation job idempotently", async () => {
    const queue = new InMemoryDhis2ExportQueue()
    const input = {
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      period: "202608",
      orgUnit: "OU_SIM_FACILITY",
      facts: fixtureAggregateFacts().map((f) => ({ ...f, localOrgKey: "OU_SIM_FACILITY", period: "202608" })),
      capabilityGranted: true,
      mode: "simulation" as const,
      isSynthetic: true,
    }
    const first = queue.enqueue(input)
    assert.ok(first.job)
    assert.equal(first.created, true)
    const second = queue.enqueue(input)
    assert.equal(second.created, false)
    assert.equal(second.job?.id, first.job!.id)

    const processed = await queue.process(first.job!.id)
    assert.equal(processed.status, "succeeded")
    assert.ok(processed.recordsExported >= 1)
  })

  it("rejects when capability is missing", () => {
    const queue = new InMemoryDhis2ExportQueue()
    const result = queue.enqueue({
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      period: "202608",
      orgUnit: "OU_SIM",
      facts: fixtureAggregateFacts(),
      capabilityGranted: false,
      mode: "simulation",
    })
    assert.equal(result.job, null)
    assert.ok(result.rejected)
  })
})
