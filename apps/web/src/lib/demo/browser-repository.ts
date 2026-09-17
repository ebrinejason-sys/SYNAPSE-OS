"use client"

/** Local-only synthetic playground storage. This module never calls Supabase. */
export const DEMO_DB_NAME = "synapse-demo-playground"
export const DEMO_DB_VERSION = 1
export const DEMO_STORES = ["facilities", "users", "persons", "identifiers", "encounters", "triage", "observations", "orders", "specimens", "lab_results", "diagnoses", "prescriptions", "inventory", "dispenses", "invoices", "payments", "referrals", "timeline", "sync_queue", "audit"] as const
export type DemoStore = typeof DEMO_STORES[number]
export type DemoState = Partial<Record<DemoStore, unknown[]>>

const seed: DemoState = {
  facilities: [
    { id: "demo-hospital", name: "SYNAPSE Demo Hospital", type: "hospital" },
    { id: "demo-clinic", name: "SYNAPSE Demo Clinic", type: "clinic" },
    { id: "demo-lab", name: "SYNAPSE Demo Laboratory", type: "laboratory" },
    { id: "demo-pharmacy", name: "SYNAPSE Demo Pharmacy", type: "pharmacy" },
  ],
  persons: [{ id: "amina-demo", name: "Amina Demo", synthetic: true }],
  timeline: [{ id: "playground-start", type: "playground_started", at: new Date().toISOString() }],
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEMO_DB_NAME, DEMO_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of DEMO_STORES) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("DEMO_DB_OPEN_FAILED"))
  })
}

export async function resetDemoPlayground(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...DEMO_STORES], "readwrite")
    for (const store of DEMO_STORES) tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("DEMO_DB_RESET_FAILED"))
  })
  const db2 = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction([...DEMO_STORES], "readwrite")
    for (const [store, rows] of Object.entries(seed)) for (const row of rows ?? []) tx.objectStore(store).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("DEMO_DB_SEED_FAILED"))
  })
  db.close(); db2.close()
}

export async function exportDemoPlayground(): Promise<DemoState> {
  const db = await openDb()
  const result: DemoState = {}
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...DEMO_STORES], "readonly")
    for (const store of DEMO_STORES) { const request = tx.objectStore(store).getAll(); request.onsuccess = () => { result[store] = request.result } }
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error("DEMO_DB_EXPORT_FAILED"))
  })
  db.close(); return result
}

export async function importDemoPlayground(state: DemoState): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...DEMO_STORES], "readwrite")
    for (const [store, rows] of Object.entries(state)) if ((DEMO_STORES as readonly string[]).includes(store)) for (const row of rows ?? []) if (row && typeof row === "object" && "id" in row) tx.objectStore(store).put(row)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error("DEMO_DB_IMPORT_FAILED"))
  })
  db.close()
}
