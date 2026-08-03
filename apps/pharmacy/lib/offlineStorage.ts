/**
 * Offline storage stub for the web pharmacy app.
 * Durable offline POS is NOT implemented. Callers must not treat these as success.
 */

export class OfflineUnavailableError extends Error {
  constructor(message = "Offline persistence is disabled until a durable encrypted queue ships.") {
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
  throw new OfflineUnavailableError()
}

export async function getPendingActions(): Promise<unknown[]> {
  return []
}

export async function saveMetadata(_key: string, _value: unknown): Promise<void> {
  // Metadata cache is non-financial — allow no-op.
}

export async function getMetadata(_key: string): Promise<unknown> {
  return null
}
