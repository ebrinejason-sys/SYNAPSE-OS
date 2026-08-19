import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  assertSyncCommand,
  canonicalizePayload,
  conflictPolicyFor,
  hashPayload,
  resolveSyncConflict,
  SYNC_SCHEMA_VERSION,
  toSyncOutboxRow,
  type SyncCommand,
} from "@synapse/db/sync-contract"
import { requirePersonSubject } from "@synapse/interop"

const registry = JSON.parse(
  readFileSync(new URL("../../../../docs/implementation/capability-registry.json", import.meta.url), "utf8"),
) as {
  features: Array<{ feature: string; status: string; offline_support: boolean }>
}

const UUID = {
  command: "11111111-1111-4111-8111-111111111111",
  tenant: "22222222-2222-4222-8222-222222222222",
  facility: "33333333-3333-4333-8333-333333333333",
  device: "44444444-4444-4444-8444-444444444444",
  actor: "55555555-5555-4555-8555-555555555555",
  sale: "66666666-6666-4666-8666-666666666666",
}

function command(overrides: Partial<SyncCommand> = {}): SyncCommand {
  return {
    commandId: UUID.command,
    commandType: "pharmacy.sale.complete.v1",
    schemaVersion: SYNC_SCHEMA_VERSION,
    tenantId: UUID.tenant,
    facilityId: UUID.facility,
    deviceId: UUID.device,
    actorId: UUID.actor,
    aggregateType: "pharmacy_sale",
    aggregateId: UUID.sale,
    capturedAtClient: "2026-08-19T12:00:00.000Z",
    payload: { items: [{ sku: "AMX500", qty: 1 }] },
    payloadHash: "pending",
    ...overrides,
  }
}

describe("SyncCommand contract", () => {
  it("rejects an unsaved command missing ids", () => {
    expect(() =>
      assertSyncCommand(
        command({
          commandId: "not-a-uuid",
        }),
      ),
    ).toThrow("COMMAND_ID_REQUIRED")
  })

  it("hashes payloads stably regardless of key order", async () => {
    const a = await hashPayload({ b: 1, a: 2 })
    const b = await hashPayload({ a: 2, b: 1 })
    expect(a).toBe(b)
    expect(canonicalizePayload({ b: 1, a: 2 })).toBe(canonicalizePayload({ a: 2, b: 1 }))
  })

  it("treats same commandId + hash as replay, never last-write-wins", async () => {
    const payloadHash = await hashPayload({ total: 1000 })
    expect(
      resolveSyncConflict({
        existing: { commandId: UUID.command, payloadHash, status: "applied" },
        incoming: { commandId: UUID.command, payloadHash },
        commandType: "pharmacy.sale.complete.v1",
      }),
    ).toBe("replay")

    const conflict = resolveSyncConflict({
      existing: { commandId: UUID.command, payloadHash, status: "applied" },
      incoming: { commandId: UUID.command, payloadHash: "different" },
      commandType: "pharmacy.sale.complete.v1",
    })
    expect(conflict).not.toBe("replay")
    if (conflict === "replay") throw new Error("unreachable")
    expect(conflict.reason).toBe("idempotency_mismatch")
    expect(conflict.policy).toBe("human_review")
  })

  it("maps a valid command onto the outbox row using commandId as idempotency key", async () => {
    const payloadHash = await hashPayload({ total: 500 })
    const row = toSyncOutboxRow(command({ payloadHash }))
    expect(row.idempotency_key).toBe(UUID.command)
    expect(row.tenant_id).toBe(UUID.tenant)
    expect(row.status).toBe("queued")
    expect(conflictPolicyFor("pharmacy.sale.complete.v1")).toBe("idempotent_replay")
  })
})

describe("clinical contracts", () => {
  it("requires a person or facility patient subject", () => {
    expect(() => requirePersonSubject({})).toThrow("CLINICAL_SUBJECT_REQUIRED")
    expect(() => requirePersonSubject({ personId: UUID.actor })).not.toThrow()
  })
})

describe("capability registry", () => {
  it("does not claim durable offline POS is operational", () => {
    const offline = registry.features.find((f) => f.feature === "offline_durable_pos")
    expect(offline?.status).toBe("PLANNED")
    expect(offline?.offline_support).toBe(false)
  })

  it("keeps online POS as operational", () => {
    const pos = registry.features.find((f) => f.feature === "pos_online_sale")
    expect(pos?.status).toBe("OPERATIONAL")
  })
})
