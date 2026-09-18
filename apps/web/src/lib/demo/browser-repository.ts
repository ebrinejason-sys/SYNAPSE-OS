"use client"

/** Local-only synthetic playground storage. This module never calls Supabase. */
export const DEMO_DB_NAME = "synapse-demo-playground"
export const DEMO_DB_VERSION = 2
export const DEMO_STORES = [
  "facilities", 
  "users", 
  "persons", 
  "identifiers", 
  "encounters", 
  "queues",           // NEW: patient queue management
  "triage",           // vitals and triage assessments
  "observations",     // clinical observations
  "clinical_notes",   // NEW: clinical documentation
  "orders", 
  "specimens", 
  "lab_results", 
  "diagnoses", 
  "prescriptions", 
  "inventory",        // inventory items catalog
  "batches",          // NEW: inventory batches with expiry
  "dispenses", 
  "invoices",
  "invoice_items",    // NEW: itemized billing
  "payments", 
  "referrals",
  "exchange_events",  // NEW: inter-facility events
  "notifications",    // NEW: user notifications
  "timeline", 
  "sync_queue", 
  "audit"
] as const
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
export async function queuePatient(input: Omit<DemoQueueItem, "id"|"createdAt"|"updatedAt">) { return put<DemoQueueItem>("queues", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export const getQueue = () => all<DemoQueueItem>("queues")
export async function recordTriage(input: Omit<DemoTriage, "id"|"createdAt"|"updatedAt">) { return put<DemoTriage>("triage", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export const getTriage = async (encounterId: string) => (await all<DemoTriage>("triage")).find(t => t.encounterId === encounterId)
export async function saveClinicalNote(input: Omit<DemoClinicalNote, "id"|"createdAt"|"updatedAt"> & { id?: string }) { return put<DemoClinicalNote>("clinical_notes", { ...input, id: input.id ?? crypto.randomUUID(), createdAt: now(), updatedAt: now() }) }
export const getClinicalNote = async (encounterId: string) => (await all<DemoClinicalNote>("clinical_notes")).find(n => n.encounterId === encounterId)

// ============================================
// EXTENDED REPOSITORY METHODS
// ============================================

import type { 
  DemoOrder, DemoSpecimen, DemoLabResult, DemoDiagnosis, 
  DemoPrescription, DemoInventoryItem, DemoBatch, DemoDispense,
  DemoInvoice, DemoInvoiceItem, DemoPayment, DemoExchangeEvent,
  DemoNotification, DemoObservation
} from "./entities"

// Lab workflow
export const createOrder = async (input: Omit<DemoOrder, "id"|"createdAt"|"updatedAt">) => 
  put<DemoOrder>("orders", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getOrders = () => all<DemoOrder>("orders")
export const getOrdersByFacility = async (facilityId: string) => 
  (await getOrders()).filter(o => o.destinationFacilityId === facilityId)
export const updateOrder = async (id: string, updates: Partial<DemoOrder>) => {
  const orders = await getOrders()
  const order = orders.find(o => o.id === id)
  if (!order) throw new Error("Order not found")
  return put<DemoOrder>("orders", { ...order, ...updates, updatedAt: now() })
}

export const createSpecimen = async (input: Omit<DemoSpecimen, "id"|"createdAt"|"updatedAt">) =>
  put<DemoSpecimen>("specimens", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getSpecimens = () => all<DemoSpecimen>("specimens")

export const createLabResult = async (input: Omit<DemoLabResult, "id"|"createdAt"|"updatedAt">) =>
  put<DemoLabResult>("lab_results", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getLabResults = () => all<DemoLabResult>("lab_results")
export const getLabResultsByOrder = async (orderId: string) =>
  (await getLabResults()).filter(r => r.orderId === orderId)

// Clinical workflow
export const createDiagnosis = async (input: Omit<DemoDiagnosis, "id"|"createdAt"|"updatedAt">) =>
  put<DemoDiagnosis>("diagnoses", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getDiagnoses = () => all<DemoDiagnosis>("diagnoses")

export const createObservation = async (input: Omit<DemoObservation, "id"|"createdAt"|"updatedAt">) =>
  put<DemoObservation>("observations", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getObservations = () => all<DemoObservation>("observations")

// Prescription workflow
export const createPrescription = async (input: Omit<DemoPrescription, "id"|"createdAt"|"updatedAt">) =>
  put<DemoPrescription>("prescriptions", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getPrescriptions = () => all<DemoPrescription>("prescriptions")
export const getPrescriptionsByFacility = async (facilityId: string) =>
  (await getPrescriptions()).filter(p => p.facilityId === facilityId)
export const updatePrescription = async (id: string, updates: Partial<DemoPrescription>) => {
  const prescriptions = await getPrescriptions()
  const prescription = prescriptions.find(p => p.id === id)
  if (!prescription) throw new Error("Prescription not found")
  return put<DemoPrescription>("prescriptions", { ...prescription, ...updates, updatedAt: now() })
}

// Pharmacy inventory
export const getInventoryItems = () => all<DemoInventoryItem>("inventory")
export const getBatches = () => all<DemoBatch>("batches")
export const getBatchesByItem = async (itemId: string) =>
  (await getBatches()).filter(b => b.inventoryItemId === itemId && b.quantity > 0)
export const updateBatch = async (id: string, updates: Partial<DemoBatch>) => {
  const batches = await getBatches()
  const batch = batches.find(b => b.id === id)
  if (!batch) throw new Error("Batch not found")
  return put<DemoBatch>("batches", { ...batch, ...updates, updatedAt: now() })
}

export const createDispense = async (input: Omit<DemoDispense, "id"|"createdAt"|"updatedAt">) =>
  put<DemoDispense>("dispenses", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getDispenses = () => all<DemoDispense>("dispenses")

// Billing
export const createInvoice = async (input: Omit<DemoInvoice, "id"|"createdAt"|"updatedAt">) =>
  put<DemoInvoice>("invoices", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getInvoices = () => all<DemoInvoice>("invoices")
export const getInvoiceByEncounter = async (encounterId: string) =>
  (await getInvoices()).find(i => i.encounterId === encounterId)

export const createInvoiceItem = async (input: Omit<DemoInvoiceItem, "id"|"createdAt"|"updatedAt">) =>
  put<DemoInvoiceItem>("invoice_items", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getInvoiceItems = () => all<DemoInvoiceItem>("invoice_items")
export const getInvoiceItemsByInvoice = async (invoiceId: string) =>
  (await getInvoiceItems()).filter(i => i.invoiceId === invoiceId)

export const createPayment = async (input: Omit<DemoPayment, "id"|"createdAt"|"updatedAt">) =>
  put<DemoPayment>("payments", { ...input, id: crypto.randomUUID(), createdAt: now(), updatedAt: now() })
export const getPayments = () => all<DemoPayment>("payments")

// Exchange events (facility communication)
export const createExchangeEvent = async (input: Omit<DemoExchangeEvent, "id"|"createdAt">) =>
  put<DemoExchangeEvent>("exchange_events", { ...input, id: crypto.randomUUID(), createdAt: now() })
export const getExchangeEvents = () => all<DemoExchangeEvent>("exchange_events")
export const getExchangeEventsByFacility = async (facilityId: string) =>
  (await getExchangeEvents()).filter(e => e.destinationFacilityId === facilityId || e.sourceFacilityId === facilityId)

// Notifications
export const createNotification = async (input: Omit<DemoNotification, "id"|"createdAt">) =>
  put<DemoNotification>("notifications", { ...input, id: crypto.randomUUID(), createdAt: now() })
export const getNotifications = () => all<DemoNotification>("notifications")
export const getNotificationsByUser = async (userId: string) =>
  (await getNotifications()).filter(n => n.userId === userId)
export const markNotificationRead = async (id: string) => {
  const notifications = await getNotifications()
  const notification = notifications.find(n => n.id === id)
  if (!notification) throw new Error("Notification not found")
  return put<DemoNotification>("notifications", { ...notification, read: true })
}

// Encounters
export const getEncounters = () => all<DemoEncounter>("encounters")
export const getEncounter = async (id: string) => (await getEncounters()).find(e => e.id === id)
export const updateEncounter = async (id: string, updates: Partial<DemoEncounter>) => {
  const encounters = await getEncounters()
  const encounter = encounters.find(e => e.id === id)
  if (!encounter) throw new Error("Encounter not found")
  return put<DemoEncounter>("encounters", { ...encounter, ...updates, updatedAt: now() })
}

// Timeline
export const getTimeline = () => all("timeline")
export const getTimelineByPerson = async (personId: string) =>
  (await getTimeline()).filter((e: any) => e.personId === personId)

export async function appendTimelineEvent(event: Record<string, unknown>) { return put("timeline", { ...event, id: crypto.randomUUID(), createdAt: now() }) }
export async function appendAuditEvent(event: Record<string, unknown>) { return put("audit", { ...event, id: crypto.randomUUID(), createdAt: now() }) }

const seed: DemoState = {
  facilities: [
    { id: "demo-hospital", name: "SYNAPSE Demo Hospital", type: "hospital", code: "DEMO-HOSP-001", createdAt: now(), updatedAt: now() },
    { id: "demo-clinic", name: "SYNAPSE Demo Clinic", type: "clinic", code: "DEMO-CLIN-001", createdAt: now(), updatedAt: now() },
    { id: "demo-lab", name: "SYNAPSE Demo Laboratory", type: "laboratory", code: "DEMO-LAB-001", createdAt: now(), updatedAt: now() },
    { id: "demo-pharmacy", name: "SYNAPSE Demo Pharmacy", type: "pharmacy", code: "DEMO-PHAR-001", createdAt: now(), updatedAt: now() },
  ],
  users: [
    { id: "reception-demo", name: "Reception Demo", role: "reception", facilityId: "demo-hospital", email: "reception@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "nurse-demo", name: "Nurse Demo", role: "nurse", facilityId: "demo-hospital", email: "nurse@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "doctor-demo", name: "Doctor Demo", role: "doctor", facilityId: "demo-hospital", email: "doctor@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "lab-tech-demo", name: "Lab Technician Demo", role: "lab_technician", facilityId: "demo-lab", email: "labtech@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "lab-scientist-demo", name: "Lab Scientist Demo", role: "lab_scientist", facilityId: "demo-lab", email: "scientist@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "pharmacist-demo", name: "Pharmacist Demo", role: "pharmacist", facilityId: "demo-pharmacy", email: "pharmacist@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "cashier-demo", name: "Cashier Demo", role: "cashier", facilityId: "demo-hospital", email: "cashier@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
    { id: "admin-demo", name: "Admin Demo", role: "admin", facilityId: "demo-hospital", email: "admin@demo.synapseos.tech", createdAt: now(), updatedAt: now() },
  ],
  persons: [
    { 
      id: "demo-person-amina", 
      name: "Amina Demo", 
      synapseId: "SYN-UG-DEMO-0001", 
      dateOfBirth: "1995-03-15",
      sex: "female",
      phone: "+256700000001",
      address: "Demo District, Kampala",
      synthetic: true,
      createdAt: now(),
      updatedAt: now()
    }
  ],
  inventory: [
    { id: "inv-amoxicillin", facilityId: "demo-pharmacy", name: "Amoxicillin", genericName: "Amoxicillin", strength: "500mg", form: "Capsule", unit: "capsule", category: "Antibiotics", requiresPrescription: true, standardPrice: 500, createdAt: now(), updatedAt: now() },
    { id: "inv-paracetamol", facilityId: "demo-pharmacy", name: "Paracetamol", genericName: "Paracetamol", strength: "500mg", form: "Tablet", unit: "tablet", category: "Analgesics", requiresPrescription: false, standardPrice: 200, createdAt: now(), updatedAt: now() },
    { id: "inv-artemether-lumefantrine", facilityId: "demo-pharmacy", name: "Coartem", genericName: "Artemether-Lumefantrine", strength: "20/120mg", form: "Tablet", unit: "tablet", category: "Antimalarials", requiresPrescription: true, standardPrice: 3000, createdAt: now(), updatedAt: now() },
    { id: "inv-metronidazole", facilityId: "demo-pharmacy", name: "Metronidazole", genericName: "Metronidazole", strength: "400mg", form: "Tablet", unit: "tablet", category: "Antibiotics", requiresPrescription: true, standardPrice: 300, createdAt: now(), updatedAt: now() },
    { id: "inv-ors", facilityId: "demo-pharmacy", name: "ORS", genericName: "Oral Rehydration Salts", strength: "20.5g", form: "Sachet", unit: "sachet", category: "Rehydration", requiresPrescription: false, standardPrice: 500, createdAt: now(), updatedAt: now() },
  ],
  batches: [
    { id: "batch-amox-001", inventoryItemId: "inv-amoxicillin", facilityId: "demo-pharmacy", batchNumber: "AMX2024-001", quantity: 500, expiryDate: "2026-12-31", costPrice: 300, salePrice: 500, createdAt: now(), updatedAt: now() },
    { id: "batch-para-001", inventoryItemId: "inv-paracetamol", facilityId: "demo-pharmacy", batchNumber: "PCM2024-001", quantity: 1000, expiryDate: "2026-06-30", costPrice: 100, salePrice: 200, createdAt: now(), updatedAt: now() },
    { id: "batch-coar-001", inventoryItemId: "inv-artemether-lumefantrine", facilityId: "demo-pharmacy", batchNumber: "AL2024-001", quantity: 200, expiryDate: "2027-03-31", costPrice: 2000, salePrice: 3000, createdAt: now(), updatedAt: now() },
    { id: "batch-metro-001", inventoryItemId: "inv-metronidazole", facilityId: "demo-pharmacy", batchNumber: "MTZ2024-001", quantity: 300, expiryDate: "2026-09-30", costPrice: 150, salePrice: 300, createdAt: now(), updatedAt: now() },
    { id: "batch-ors-001", inventoryItemId: "inv-ors", facilityId: "demo-pharmacy", batchNumber: "ORS2024-001", quantity: 400, expiryDate: "2028-12-31", costPrice: 300, salePrice: 500, createdAt: now(), updatedAt: now() },
  ],
  timeline: [{ id: "playground-start", type: "playground_started", personId: "system", facilityId: "demo-hospital", actorId: "system", eventType: "system", title: "Demo playground initialized", createdAt: now() }],
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEMO_DB_NAME, DEMO_DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion
      
      // Create all stores that don't exist
      for (const store of DEMO_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" })
        }
      }
      
      // Migration from v1 to v2: no data migration needed, just new stores
      if (oldVersion === 1) {
        console.log("[Demo DB] Upgraded from v1 to v2: added queues, clinical_notes, batches, invoice_items, exchange_events, notifications")
      }
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
