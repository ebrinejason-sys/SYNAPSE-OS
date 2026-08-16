/**
 * Pharmacy offline facade.
 * Generic HTTP mutation replay is still forbidden. POS sales go through the
 * typed `pharmacy.sale.complete.v1` outbox in `@synapse/offline`.
 */

import { pendingCommands } from "@synapse/offline"
import { pharmacyOffline } from "./offline/client"

export class OfflineUnavailableError extends Error {
  constructor(message = "Generic offline mutation replay is disabled. Use the POS sale outbox.") {
    super(message)
    this.name = "OfflineUnavailableError"
  }
}

export async function queueMutation(
  _url: string,
  _method: string,
  _body: unknown,
  _headers: HeadersInit = {},
): Promise<void> {
  throw new OfflineUnavailableError()
}

export async function saveOfflineTransaction(_transaction: unknown): Promise<void> {
  throw new OfflineUnavailableError(
    "Use commitOfflineSale() — unstructured transaction blobs are not durable sales.",
  )
}

export async function getPendingActions(): Promise<unknown[]> {
  try {
    const engine = await pharmacyOffline()
    const all = await engine.listAllCommands()
    return pendingCommands(all)
  } catch {
    return []
  }
}

export async function saveMetadata(key: string, value: unknown): Promise<void> {
  try {
    const engine = await pharmacyOffline()
    await engine.setMeta(key, value)
  } catch {
    // Non-financial cache — ignore persistence failures.
  }
}

export async function getMetadata(key: string): Promise<unknown> {
  try {
    const engine = await pharmacyOffline()
    return engine.getMeta(key)
  } catch {
    return null
  }
}
