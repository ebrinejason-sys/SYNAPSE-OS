"use client"

/** Local-only synthetic playground storage. This module never calls Supabase. */
export const DEMO_DB_NAME = "synapse-demo-playground"
export const DEMO_DB_VERSION = 1
export const DEMO_STORES = ["facilities", "users", "persons", "identifiers", "encounters", "triage", "observations", "orders", "specimens", "lab_results", "diagnoses", "prescriptions", "inventory", "dispenses", "invoices", "payments", "referrals", "timeline", "sync_queue", "audit"] as const
export type DemoStore = typeof DEMO_STORES[number]
export type DemoState = Partial<Record<DemoStore, unknown[]>>
import type { DemoEncounter, DemoPerson, DemoQueueItem, DemoTriage, DemoClinicalNote } from "./entities"
const now = () => new Date().toISOString()
async function put<T>(store: DemoStore, value: T) { const db = await openDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close(); return value }
async function all<T>(store: DemoStore): Promise<T[]> { const db = await openDb(); return await new Promise<T[]>((resolve, reject) => { const r = db.transaction(store, "readonly").objectStore(store).getAll(); r.onsuccess = () => { db.close(); resolve(r.result as T[]) }; r.onerror = () => reject(r.error) }) }
export async function initializePlayground() { await openDb(); if ((await all("persons")).length === 0) await resetDemoPlayground() }
export const getFacilities = () => all("facilities")
export const getUsers = () => all("users")
export const getPersons = () => all<DemoPerson>("persons")
export async function getPerson(id: string) { return (await getPersons()).find(p => p.id === id) }
export async function createEncounter(input: Omit<DemoEncounter, "id"|"createdAt"|"updatedAt">) { return put<DemoEncounter>("encounters", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export async function queuePatient(input: Omit<DemoQueueItem, "id"|"createdAt"|"updatedAt">) { return put<DemoQueueItem>("triage", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export const getQueue = () => all<DemoQueueItem>("triage")
export async function recordTriage(input: Omit<DemoTriage, "id"|"createdAt"|"updatedAt">) { return put<DemoTriage>("observations", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export async function saveClinicalNote(input: Omit<DemoClinicalNote, "id"|"createdAt"|"updatedAt"> & { id?: string }) { return put<DemoClinicalNote>("encounters", { ...input, id: input.id ?? crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export async function appendTimelineEvent(event: Record<string, unknown>) { return put("timeline", { ...event, id: crypto.randomUUID(), createdAt: now() }) }
export async function appendAuditEvent(event: Record<string, unknown>) { return put("audit", { ...event, id: crypto.randomUUID(), createdAt: now() }) }

const seed: DemoState = {
  facilities: [
    { id: "demo-hospital", name: "SYNAPSE Demo Hospital", type: "hospital" },
    { id: "demo-clinic", name: "SYNAPSE Demo Clinic", type: "clinic" },
    { id: "demo-lab", name: "SYNAPSE Demo Laboratory", type: "laboratory" },
    { id: "demo-pharmacy", name: "SYNAPSE Demo Pharmacy", type: "pharmacy" },
  ],
  users: ["reception", "nurse", "doctor", "lab-tech", "lab-scientist", "pharmacist", "cashier", "admin"].map(role => ({ id: `${role}-demo`, name: `${role} demo`, role, facilityId: "demo-hospital" })),
  persons: [{ id: "demo-person-amina", name: "Amina Demo", synapseId: "SYN-UG-DEMO-0001", synthetic: true }],
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
