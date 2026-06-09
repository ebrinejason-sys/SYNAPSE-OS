// Offline storage stub — Electron desktop features are no-ops in the web app.
// The web version relies on Supabase directly; these APIs exist for API compatibility.

export async function queueMutation(
  _url: string,
  _method: string,
  _body: unknown,
  _headers: HeadersInit = {}
): Promise<void> {
  // No-op in web mode
}

export async function saveOfflineTransaction(_transaction: unknown): Promise<void> {
  // No-op in web mode
}

export async function getPendingActions(): Promise<unknown[]> {
  return []
}

export async function saveMetadata(_key: string, _value: unknown): Promise<void> {
  // No-op in web mode
}

export async function getMetadata(_key: string): Promise<unknown> {
  return null
}
