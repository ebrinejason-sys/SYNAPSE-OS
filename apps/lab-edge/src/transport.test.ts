import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createConnection } from "node:net"
import { buildHl7ChemistrySimulatorMessage, createEdgeListener, EdgeDurableQueue, frameHl7Mllp, unwrapHl7Mllp } from "./index.ts"

describe("Lab Edge transport", () => {
  it("frames and unwraps HL7 MLLP safely", () => {
    const payload = buildHl7ChemistrySimulatorMessage("LAB-20260904-000001")
    assert.equal(unwrapHl7Mllp(frameHl7Mllp(payload)), payload)
    assert.equal(unwrapHl7Mllp("\x0bpartial"), null)
  })

  it("receives a synthetic HL7 message through TCP into SQLite", async () => {
    const queue = new EdgeDurableQueue()
    const server = createEdgeListener(queue, { host: "127.0.0.1", port: 0, deviceId: "device-1", protocol: "HL7_MLLP" })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port: address.port })
      socket.once("error", reject)
      socket.once("connect", () => socket.end(frameHl7Mllp(buildHl7ChemistrySimulatorMessage("LAB-20260904-000002")), resolve))
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(queue.pending().length, 1)
    assert.equal(queue.pending()[0]?.protocol, "HL7_MLLP")
    await new Promise<void>((resolve) => server.close(() => resolve()))
    queue.close()
  })
})