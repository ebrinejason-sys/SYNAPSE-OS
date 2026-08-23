import { describe, expect, it } from "vitest"
import {
  decryptJson,
  encryptJson,
  generateOfflineKeyBytes,
  isEncryptedEnvelope,
} from "@synapse/db/offline-crypto"

describe("offline AES-GCM", () => {
  it("round-trips a SyncCommand payload and never stores plaintext", async () => {
    const key = await generateOfflineKeyBytes()
    const payload = { items: [{ sku: "AMX500", qty: 1 }], customerName: "Aisha" }
    const envelope = await encryptJson(payload, key)
    expect(isEncryptedEnvelope(envelope)).toBe(true)
    expect(envelope.includes("Aisha")).toBe(false)
    expect(await decryptJson(envelope, key)).toEqual(payload)
  })
})
