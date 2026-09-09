import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { EdgeDurableQueue, EdgeService, uploadPending } from "./index.ts"

describe("Lab Edge SQLite queue", () => {
  it("recovers queued messages after a process restart and deduplicates payloads", () => {
    const dir = mkdtempSync(join(tmpdir(), "synapse-edge-"))
    const path = join(dir, "edge.sqlite")
    const first = new EdgeDurableQueue(path)
    const item = first.enqueue("raw-message", "ASTM")
    first.enqueue("raw-message", "ASTM")
    assert.equal(first.pending().length, 1)
    first.close()
    const restarted = new EdgeDurableQueue(path)
    assert.equal(restarted.pending()[0]?.id, item.id)
    assert.equal(restarted.pending()[0]?.state, "QUEUED")
    restarted.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it("uploads once and keeps transient failures retryable", async () => {
    const queue = new EdgeDurableQueue()
    const item = queue.enqueue("raw", "HL7")
    const responses = [new Response(JSON.stringify({ error: "offline" }), { status: 503 }), new Response(JSON.stringify({ messageId: "cloud-1" }), { status: 200 })]
    const fetchImpl = async () => responses.shift()!
    const first = await uploadPending(queue, "https://example.test/ingest", "bridge", "device-1", fetchImpl)
    assert.deepEqual(first, { uploaded: 0, failed: 1 })
    assert.equal(queue.get(item.id)?.state, "FAILED")
    const failed = queue.get(item.id)!
    assert.equal(failed.attempts, 1)
    queue.retry(item.id)
    const second = await uploadPending(queue, "https://example.test/ingest", "bridge", "device-1", fetchImpl)
    assert.deepEqual(second, { uploaded: 1, failed: 0 })
    assert.equal(queue.get(item.id)?.state, "ACKNOWLEDGED")
    queue.close()
  })

  it("replays an offline message after restart and remains idempotent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "synapse-edge-replay-"))
    const path = join(dir, "edge.sqlite")
    const first = new EdgeDurableQueue(path)
    const item = first.enqueue("offline-message", "ASTM")
    const offline = await uploadPending(first, "https://example.test/ingest", "bridge", "device-1", async () => {
      throw new Error("network_offline")
    })
    assert.deepEqual(offline, { uploaded: 0, failed: 1 })
    first.close()

    const restarted = new EdgeDurableQueue(path)
    restarted.retry(item.id)
    const requests: Request[] = []
    const online = await uploadPending(restarted, "https://example.test/ingest", "bridge", "device-1", async (input, init) => {
      requests.push(new Request(input, init))
      return new Response(JSON.stringify({ messageId: "cloud-replay-1" }), { status: 200 })
    })
    assert.deepEqual(online, { uploaded: 1, failed: 0 })
    assert.equal(restarted.get(item.id)?.state, "ACKNOWLEDGED")
    assert.equal(requests.length, 1)
    assert.equal(restarted.pending().length, 0)
    assert.equal(restarted.enqueue("offline-message", "ASTM").id, item.id)
    restarted.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it("sends authenticated heartbeat metadata without analyzer or patient data", async () => {
    const queue = new EdgeDurableQueue()
    const requests: Request[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const service = new EdgeService(queue, { port: 0, deviceId: "device-1", bridgeId: "bridge-1", protocol: "ASTM", heartbeatIntervalMs: 60_000 }, "https://example.test/api/lab/instrument-ingest", "secret", fetchImpl)
    await service.start()
    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, "https://example.test/api/lab/edge/heartbeat")
    assert.equal(requests[0]?.headers.get("x-lab-bridge-key"), "secret")
    const payload = await requests[0]!.json() as Record<string, unknown>
    assert.equal(payload.deviceId, "device-1")
    assert.equal(payload.bridgeId, "bridge-1")
    assert.equal("rawPayload" in payload, false)
    assert.equal("patientName" in payload, false)
    await service.stop()
  })
})