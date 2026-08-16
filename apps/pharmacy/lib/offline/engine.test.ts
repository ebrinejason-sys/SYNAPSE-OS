import { describe, expect, it } from "vitest"
import {
  MemoryOfflineStore,
  OfflineEngine,
  classifySyncResponse,
  isCatalogFresh,
  sha256Hex,
  type CatalogSnapshot,
  type CommitSaleInput,
} from "@synapse/offline"
import { queueMutation, OfflineUnavailableError } from "../offlineStorage"

const now = new Date("2026-08-16T12:00:00.000Z")

function snapshot(over: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    tenantId: "tenant-1",
    capturedAt: now.toISOString(),
    identity: {
      tenantId: "tenant-1",
      actorId: "cashier-1",
      actorName: "Ada",
      isAdmin: false,
      pharmacyRole: "pharmacy_staff",
    },
    products: [
      {
        id: "amox",
        name: "Amoxicillin 500mg",
        price: 2000,
        quantity: 10,
        sellableQuantity: 10,
        isActive: true,
        batches: [
          {
            id: "b-soon",
            batchNumber: "SOON",
            quantity: 4,
            expiryDate: "2026-09-01",
            costPrice: 800,
            manufacturer: "GSK",
          },
          {
            id: "b-late",
            batchNumber: "LATE",
            quantity: 6,
            expiryDate: "2027-01-01",
            costPrice: 700,
            manufacturer: "Cipla",
          },
        ],
      },
    ],
    settings: { currency: "UGX" },
    staff: [],
    ...over,
  }
}

function sale(qty: number, over: Partial<CommitSaleInput> = {}): CommitSaleInput {
  return {
    tenantId: "tenant-1",
    actorId: "cashier-1",
    paymentMethod: "CASH",
    taxAmount: 0,
    receiptStaffName: "Ada",
    items: [
      {
        productId: "amox",
        productName: "Amoxicillin 500mg",
        quantity: qty,
        listPrice: 2000,
        unitPrice: 2000,
        discountAmount: 0,
        discountReason: null,
        discountApprovedBy: null,
        costPrice: 800,
        packageName: null,
        packageQuantity: null,
      },
    ],
    ...over,
  }
}

describe("offline POS engine", () => {
  it("hashes payloads stably", async () => {
    const hex = await sha256Hex("abc")
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("persists a sale before reporting success and survives restart", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const result = await engine.commitSale(sale(3), now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.command.state).toBe("queued")
    expect(result.command.payload.localReceiptNumber).toMatch(/^OFF-/)
    expect(result.command.payload.items[0].allocations[0]).toMatchObject({
      batchNumber: "SOON",
      quantity: 3,
    })

    const restarted = new OfflineEngine(MemoryOfflineStore.fromJSON(store.toJSON()))
    const pending = await restarted.commandsDue("tenant-1")
    expect(pending).toHaveLength(1)
    expect(pending[0].commandId).toBe(result.command.commandId)
    expect(pending[0].payloadHash).toBe(result.command.payloadHash)
  })

  it("reserves local FEFO stock so a second sale cannot oversell", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const first = await engine.commitSale(sale(8), now)
    const second = await engine.commitSale(sale(3), now)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe("INSUFFICIENT_STOCK")
  })

  it("allocates remaining stock across batches", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const first = await engine.commitSale(sale(4), now)
    const second = await engine.commitSale(sale(6), now)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.command.payload.items[0].allocations).toEqual([
      expect.objectContaining({ batchNumber: "LATE", quantity: 6 }),
    ])
  })

  it("blocks credit, stale catalogs, and empty carts", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const credit = await engine.commitSale(sale(1, { paymentMethod: "CREDIT" }), now)
    expect(credit.ok).toBe(false)
    if (!credit.ok) expect(credit.code).toBe("CREDIT_BLOCKED")

    const empty = await engine.commitSale(sale(1, { items: [] }), now)
    expect(empty.ok).toBe(false)

    await engine.saveSnapshot(snapshot({ capturedAt: "2026-08-10T12:00:00.000Z" }))
    const stale = await engine.commitSale(sale(1), now)
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.code).toBe("STALE_CATALOG")
    expect(
      isCatalogFresh(snapshot({ capturedAt: "2026-08-10T12:00:00.000Z" }), now.getTime()),
    ).toBe(false)
  })

  it("replays with the same idempotency key and marks accepted without double-reserving", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const committed = await engine.commitSale(sale(2, { idempotencyKey: "key-1" }), now)
    expect(committed.ok).toBe(true)
    if (!committed.ok) return

    const sending = await engine.markSending(committed.command.commandId)
    expect(sending?.payload.idempotencyKey).toBe("key-1")
    await engine.applySyncResult(sending!, 200, {
      ok: true,
      sale: { sale_id: "sale-9", receipt_number: "R-9" },
    })

    const after = await engine.projectedCatalog("tenant-1")
    expect(after.pendingCount).toBe(0)
    expect(after.products[0].sellableQuantity).toBe(8)

    const replay = await engine.getSnapshot("tenant-1")
    const leftover = replay?.products[0].batches.reduce((s, b) => s + b.quantity, 0)
    expect(leftover).toBe(8)
  })

  it("keeps a locally committed sale reserved after a server stock conflict", async () => {
    const store = new MemoryOfflineStore()
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const committed = await engine.commitSale(sale(5), now)
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const sending = await engine.markSending(committed.command.commandId)
    await engine.applySyncResult(sending!, 409, {
      code: "INSUFFICIENT_STOCK",
      error: "Not enough stock",
    })
    const after = await engine.projectedCatalog("tenant-1")
    expect(after.conflictCount).toBe(1)
    expect(after.products[0].sellableQuantity).toBe(5)
  })

  it("flushes durable store callbacks before commit returns", async () => {
    let writes = 0
    const store = new MemoryOfflineStore(undefined, () => {
      writes += 1
    })
    const engine = new OfflineEngine(store)
    await engine.saveSnapshot(snapshot())
    const before = writes
    const result = await engine.commitSale(sale(1), now)
    expect(result.ok).toBe(true)
    expect(writes).toBeGreaterThan(before)
    expect(store.toJSON().commands).toHaveLength(1)
  })

  it("classifies sync HTTP statuses", () => {
    expect(classifySyncResponse(200)).toBe("accepted")
    expect(classifySyncResponse(401)).toBe("auth")
    expect(classifySyncResponse(409, { code: "INSUFFICIENT_STOCK" })).toBe("conflict")
    expect(classifySyncResponse(400)).toBe("rejected")
    expect(classifySyncResponse(0)).toBe("retry")
    expect(classifySyncResponse(503)).toBe("retry")
  })
})

describe("legacy offlineStorage", () => {
  it("still refuses generic HTTP mutation replay", async () => {
    await expect(queueMutation("/api/admin/customers", "POST", {})).rejects.toBeInstanceOf(
      OfflineUnavailableError,
    )
  })
})
