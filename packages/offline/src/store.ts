import { newId } from "./sha256"
import type { CatalogSnapshot, SaleCommand } from "./types"

export type OfflineDump = {
  deviceId: string
  snapshots: Record<string, CatalogSnapshot>
  commands: SaleCommand[]
  meta: Record<string, unknown>
  sequences: Record<string, number>
}

export function emptyDump(): OfflineDump {
  return {
    deviceId: newId("dev-"),
    snapshots: {},
    commands: [],
    meta: {},
    sequences: {},
  }
}

export interface OfflineStore {
  getDeviceId(): Promise<string>
  getSnapshot(tenantId: string): Promise<CatalogSnapshot | null>
  saveSnapshot(snapshot: CatalogSnapshot): Promise<void>
  listCommands(tenantId: string): Promise<SaleCommand[]>
  listAllCommands(): Promise<SaleCommand[]>
  getCommand(commandId: string): Promise<SaleCommand | null>
  putCommand(command: SaleCommand): Promise<void>
  getMeta<T>(key: string): Promise<T | null>
  setMeta(key: string, value: unknown): Promise<void>
  nextLocalSequence(tenantId: string): Promise<number>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** In-memory store. Also the serialization format for file-backed adapters. */
export class MemoryOfflineStore implements OfflineStore {
  constructor(
    private dump: OfflineDump = emptyDump(),
    private readonly persist?: (dump: OfflineDump) => Promise<void> | void,
  ) {}

  private async touch(): Promise<void> {
    await this.persist?.(this.toJSON())
  }

  toJSON(): OfflineDump {
    return clone(this.dump)
  }

  static fromJSON(dump: OfflineDump): MemoryOfflineStore {
    return new MemoryOfflineStore(clone(dump))
  }

  async getDeviceId(): Promise<string> {
    if (!this.dump.deviceId) {
      this.dump.deviceId = newId("dev-")
      await this.touch()
    }
    return this.dump.deviceId
  }

  async getSnapshot(tenantId: string): Promise<CatalogSnapshot | null> {
    const snap = this.dump.snapshots[tenantId]
    return snap ? clone(snap) : null
  }

  async saveSnapshot(snapshot: CatalogSnapshot): Promise<void> {
    this.dump.snapshots[snapshot.tenantId] = clone(snapshot)
    await this.touch()
  }

  async listCommands(tenantId: string): Promise<SaleCommand[]> {
    return this.dump.commands.filter((c) => c.tenantId === tenantId).map(clone)
  }

  async listAllCommands(): Promise<SaleCommand[]> {
    return this.dump.commands.map(clone)
  }

  async getCommand(commandId: string): Promise<SaleCommand | null> {
    const found = this.dump.commands.find((c) => c.commandId === commandId)
    return found ? clone(found) : null
  }

  async putCommand(command: SaleCommand): Promise<void> {
    const idx = this.dump.commands.findIndex((c) => c.commandId === command.commandId)
    const next = clone(command)
    if (idx >= 0) this.dump.commands[idx] = next
    else this.dump.commands.push(next)
    await this.touch()
  }

  async getMeta<T>(key: string): Promise<T | null> {
    if (!(key in this.dump.meta)) return null
    return clone(this.dump.meta[key]) as T
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    this.dump.meta[key] = clone(value)
    await this.touch()
  }

  async nextLocalSequence(tenantId: string): Promise<number> {
    const next = (this.dump.sequences[tenantId] ?? 0) + 1
    this.dump.sequences[tenantId] = next
    await this.touch()
    return next
  }
}
