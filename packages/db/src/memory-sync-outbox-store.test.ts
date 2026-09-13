import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SYNC_SCHEMA_VERSION, hashPayload, type SyncCommand } from "./sync-contract.ts"
import { SyncRuntime } from "./sync-runtime.ts"
import { MemorySyncOutboxStore } from "./memory-sync-outbox-store.ts"

const IDS = {
  tenant: "22222222-2222-4222-8222-222222222222",
  facility: "33333333-3333-4333-8333-333333333333",
  device: "44444444-4444-4444-8444-444444444444",
  actor: "55555555-5555-4555-8555-555555555555",
  encounter: "66666666-6666-4666-8666-666666666666",
  command: "11111111-1111-4111-8111-111111111111",
}

async function makeCommand(payload: Record<string, unknown>, commandId = IDS.command): Promise<SyncCommand> {
  return {
    commandId,
    commandType: "clinical.encounter.writeup.v1",
    schemaVersion: SYNC_SCHEMA_VERSION,
    tenantId: IDS.tenant,
    facilityId: IDS.facility,
    deviceId: IDS.device,
    actorId: IDS.actor,
    aggregateType: "encounter",
    aggregateId: IDS.encounter,
    baseRevision: null,
    capturedAtClient: new Date().toISOString(),
    payload,
    payloadHash: await hashPayload(payload),
  }
}

describe("MemorySyncOutboxStore", () => {
  it("commits, flushes once, and replays same commandId+hash", async () => {
    const store = new MemorySyncOutboxStore()
    const runtime = new SyncRuntime(IDS.tenant, store)
    const command = await makeCommand({ encounter_id: IDS.encounter, writeup: { hpi: "fever" } })
    await runtime.commit(command)

    let applyCount = 0
    const summary = await runtime.flush(async () => {
      applyCount += 1
      return {
        outcome: "applied",
        serverAckId: "ack-1",
        checkpoint: "cp-1",
      }
    })
    assert.equal(summary.acknowledged, 1)
    assert.equal(applyCount, 1)

    const again = await runtime.commit(command)
    assert.equal(again.status === "acknowledged" || again.status === "applied" || again.status === "queued", true)

    const conflictPayload = await makeCommand({ encounter_id: IDS.encounter, writeup: { hpi: "changed" } })
    await assert.rejects(() => runtime.commit(conflictPayload), /SYNC_PAYLOAD_CONFLICT|SYNC_COMMAND_/)
  })

  it("does not surface another actor's commands after clearForActor", async () => {
    const store = new MemorySyncOutboxStore()
    const runtime = new SyncRuntime(IDS.tenant, store)
    const command = await makeCommand({ encounter_id: IDS.encounter, writeup: { hpi: "a" } })
    await runtime.commit(command)
    store.clearForActor(IDS.actor)
    const ready = await store.listReady(IDS.tenant, 10)
    assert.equal(ready.length, 0)
  })
})
