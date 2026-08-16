import {
  emptyDump,
  type CatalogSnapshot,
  type OfflineStore,
  type SaleCommand,
} from "@synapse/offline"
import {
  decryptJson,
  encryptJson,
  getOrCreateAesKey,
  idbGet,
  idbGetAll,
  idbPut,
  openPosDb,
} from "./crypto"

type EncryptedCommand = {
  commandId: string
  tenantId: string
  iv: string
  data: string
}

export class BrowserOfflineStore implements OfflineStore {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly key: CryptoKey,
    private deviceId: string,
  ) {}

  static async open(): Promise<BrowserOfflineStore> {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is not available")
    }
    const db = await openPosDb()
    const key = await getOrCreateAesKey(db)
    let deviceId = (await idbGet<string>(db, "meta", "deviceId")) ?? ""
    if (!deviceId) {
      deviceId = emptyDump().deviceId
      await idbPut(db, "meta", deviceId, "deviceId")
    }
    return new BrowserOfflineStore(db, key, deviceId)
  }

  async getDeviceId(): Promise<string> {
    return this.deviceId
  }

  async getSnapshot(tenantId: string): Promise<CatalogSnapshot | null> {
    return (await idbGet<CatalogSnapshot>(this.db, "snapshots", tenantId)) ?? null
  }

  async saveSnapshot(snapshot: CatalogSnapshot): Promise<void> {
    await idbPut(this.db, "snapshots", snapshot)
  }

  async listCommands(tenantId: string): Promise<SaleCommand[]> {
    const all = await this.listAllCommands()
    return all.filter((c) => c.tenantId === tenantId)
  }

  async listAllCommands(): Promise<SaleCommand[]> {
    const rows = await idbGetAll<EncryptedCommand>(this.db, "outbox")
    const out: SaleCommand[] = []
    for (const row of rows) {
      try {
        out.push(await decryptJson<SaleCommand>(this.key, row))
      } catch {
        // Skip undecryptable rows rather than dropping the rest of the outbox.
      }
    }
    return out
  }

  async getCommand(commandId: string): Promise<SaleCommand | null> {
    const row = await idbGet<EncryptedCommand>(this.db, "outbox", commandId)
    if (!row) return null
    try {
      return await decryptJson<SaleCommand>(this.key, row)
    } catch {
      return null
    }
  }

  async putCommand(command: SaleCommand): Promise<void> {
    const enc = await encryptJson(this.key, command)
    await idbPut(this.db, "outbox", {
      commandId: command.commandId,
      tenantId: command.tenantId,
      iv: enc.iv,
      data: enc.data,
    })
  }

  async getMeta<T>(key: string): Promise<T | null> {
    return (await idbGet<T>(this.db, "meta", key)) ?? null
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await idbPut(this.db, "meta", value, key)
  }

  async nextLocalSequence(tenantId: string): Promise<number> {
    const current = (await idbGet<number>(this.db, "sequences", tenantId)) ?? 0
    const next = current + 1
    await idbPut(this.db, "sequences", next, tenantId)
    return next
  }
}
