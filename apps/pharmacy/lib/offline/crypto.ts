function requestAs<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const POS_OFFLINE_DB = "synapse-pharm-pos-v1"
const DB_VERSION = 1

export function openPosDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(POS_OFFLINE_DB, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys", { keyPath: "id" })
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "tenantId" })
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "commandId" })
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta")
      if (!db.objectStoreNames.contains("sequences")) db.createObjectStore("sequences")
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  const tx = db.transaction(store, "readonly")
  const result = await requestAs(tx.objectStore(store).get(key))
  return result as T | undefined
}

export async function idbPut(db: IDBDatabase, store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const tx = db.transaction(store, "readwrite")
  if (key !== undefined) tx.objectStore(store).put(value, key)
  else tx.objectStore(store).put(value)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"))
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"))
  })
}

export async function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  const tx = db.transaction(store, "readonly")
  const result = await requestAs(tx.objectStore(store).getAll())
  return (result ?? []) as T[]
}

export async function getOrCreateAesKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<{ id: string; key: CryptoKey }>(db, "keys", "aes")
  if (existing?.key) return existing.key
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error("Web Crypto is required to store offline sales.")
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  await idbPut(db, "keys", { id: "aes", key })
  return key
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(value))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) }
}

export async function decryptJson<T>(key: CryptoKey, record: { iv: string; data: string }): Promise<T> {
  const iv = b64ToBytes(record.iv)
  const data = b64ToBytes(record.data)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
