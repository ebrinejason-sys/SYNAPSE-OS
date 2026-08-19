import { describe, it, expect, vi } from "vitest"
import {
  parsePharmacyRpcError,
  shipPharmacyStockTransfer,
  receivePharmacyStockTransfer,
} from "@synapse/db/inventory-rpc"
import { allocateFefo, allocatedQuantity, summarizeInventory } from "@synapse/db/inventory"

describe("parsePharmacyRpcError", () => {
  it("maps REQUIRES_BATCH to pharmacy language", () => {
    const e = parsePharmacyRpcError("REQUIRES_BATCH: a genuine batch number is required")
    expect(e.code).toBe("REQUIRES_BATCH")
    expect(e.humanMessage.toLowerCase()).toContain("batch")
  })

  it("maps INSUFFICIENT_STOCK with product context", () => {
    const e = parsePharmacyRpcError("INSUFFICIENT_STOCK: Amoxicillin short by 3 units (sellable 2)")
    expect(e.code).toBe("INSUFFICIENT_STOCK")
    expect(e.humanMessage.toLowerCase()).toMatch(/amoxicillin|sellable|short/)
  })

  it("maps ALREADY_REFUNDED", () => {
    const e = parsePharmacyRpcError("ALREADY_REFUNDED: sale R-20260810-0001 already voided")
    expect(e.code).toBe("ALREADY_REFUNDED")
    expect(e.humanMessage.toLowerCase()).toContain("already")
  })

  it("maps EXPIRED_RECEIPT", () => {
    const e = parsePharmacyRpcError("EXPIRED_RECEIPT: cannot receive stock that is already expired")
    expect(e.code).toBe("EXPIRED_RECEIPT")
    expect(e.humanMessage.toLowerCase()).toContain("expired")
  })

  it("maps TRANSFER_NOT_FOUND", () => {
    const e = parsePharmacyRpcError("TRANSFER_NOT_FOUND: 11111111-1111-1111-1111-111111111111")
    expect(e.code).toBe("TRANSFER_NOT_FOUND")
    expect(e.humanMessage.toLowerCase()).toContain("transfer")
  })

  it("maps INVALID_TRANSFER_STATE", () => {
    const e = parsePharmacyRpcError("INVALID_TRANSFER_STATE: expected draft, got received")
    expect(e.code).toBe("INVALID_TRANSFER_STATE")
    expect(e.humanMessage.toLowerCase()).toContain("state")
  })

  it("maps TRANSFER_EMPTY", () => {
    const e = parsePharmacyRpcError("TRANSFER_EMPTY: transfer has no items")
    expect(e.code).toBe("TRANSFER_EMPTY")
    expect(e.humanMessage.toLowerCase()).toContain("items")
  })
})

describe("shipPharmacyStockTransfer", () => {
  it("calls ship_pharmacy_stock_transfer with tenant-scoped args and maps the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, transfer_id: "t1", items_shipped: 2, units_shipped: 15 },
      error: null,
    })
    const { data, error } = await shipPharmacyStockTransfer(
      { rpc },
      { tenantId: "tenant-1", transferId: "t1", actorId: "actor-1" },
    )
    expect(rpc).toHaveBeenCalledWith("ship_pharmacy_stock_transfer", {
      p_tenant_id: "tenant-1",
      p_transfer_id: "t1",
      p_actor_id: "actor-1",
    })
    expect(error).toBeNull()
    expect(data).toEqual({
      ok: true,
      transferId: "t1",
      status: "in_transit",
      itemsShipped: 2,
      unitsShipped: 15,
    })
  })

  it("maps INSUFFICIENT_STOCK failures from a short source store", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "INSUFFICIENT_STOCK: Amoxicillin short by 5 units at source store" },
    })
    const { data, error } = await shipPharmacyStockTransfer(
      { rpc },
      { tenantId: "tenant-1", transferId: "t1", actorId: "actor-1" },
    )
    expect(data).toBeNull()
    expect(error?.code).toBe("INSUFFICIENT_STOCK")
  })

  it("maps INVALID_TRANSFER_STATE when the transfer is not a draft", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "INVALID_TRANSFER_STATE: expected draft, got in_transit" },
    })
    const { error } = await shipPharmacyStockTransfer(
      { rpc },
      { tenantId: "tenant-1", transferId: "t1", actorId: "actor-1" },
    )
    expect(error?.code).toBe("INVALID_TRANSFER_STATE")
  })
})

describe("receivePharmacyStockTransfer", () => {
  it("calls receive_pharmacy_stock_transfer with tenant-scoped args and maps the result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, transfer_id: "t1", allocations_received: 3, units_received: 15 },
      error: null,
    })
    const { data, error } = await receivePharmacyStockTransfer(
      { rpc },
      { tenantId: "tenant-1", transferId: "t1", actorId: "actor-2" },
    )
    expect(rpc).toHaveBeenCalledWith("receive_pharmacy_stock_transfer", {
      p_tenant_id: "tenant-1",
      p_transfer_id: "t1",
      p_actor_id: "actor-2",
    })
    expect(error).toBeNull()
    expect(data).toEqual({
      ok: true,
      transferId: "t1",
      status: "received",
      allocationsReceived: 3,
      unitsReceived: 15,
    })
  })

  it("maps TRANSFER_NOT_FOUND for a transfer outside the caller's tenant", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "TRANSFER_NOT_FOUND: t1" },
    })
    const { data, error } = await receivePharmacyStockTransfer(
      { rpc },
      { tenantId: "tenant-1", transferId: "t1", actorId: "actor-2" },
    )
    expect(data).toBeNull()
    expect(error?.code).toBe("TRANSFER_NOT_FOUND")
  })
})

describe("pilot FEFO smoke (domain)", () => {
  const TODAY = "2026-08-10"
  const batchA = {
    id: "a",
    batch_number: "BATCH-A",
    quantity: 20,
    expiry_date: "2027-06-01",
    status: "active",
    received_date: "2026-08-01",
  }
  const batchB = {
    id: "b",
    batch_number: "BATCH-B",
    quantity: 15,
    expiry_date: "2026-12-01",
    status: "active",
    received_date: "2026-08-02",
  }
  const expired = {
    id: "e",
    batch_number: "BATCH-E",
    quantity: 50,
    expiry_date: "2026-01-01",
    status: "active",
  }
  const quarantined = {
    id: "q",
    batch_number: "BATCH-Q",
    quantity: 50,
    expiry_date: "2027-01-01",
    status: "quarantined",
  }

  it("FEFO selects earlier-expiry Batch B before Batch A", () => {
    const alloc = allocateFefo([batchA, batchB], 5, { today: TODAY })
    expect(alloc[0]?.batchId).toBe("b")
    expect(allocatedQuantity(alloc)).toBe(5)
  })

  it("excludes expired and quarantined from sellable and allocation", () => {
    const s = summarizeInventory({ id: "p", name: "X", quantity: 135 }, [
      batchA,
      batchB,
      expired,
      quarantined,
    ], TODAY)
    expect(s.sellableQuantity).toBe(35)
    expect(s.expiredQuantity).toBe(50)
    expect(s.quarantinedQuantity).toBe(50)

    const alloc = allocateFefo([batchA, batchB, expired, quarantined], 100, { today: TODAY })
    expect(allocatedQuantity(alloc)).toBe(35)
    expect(alloc.every((a) => a.batchId === "a" || a.batchId === "b")).toBe(true)
  })
})
