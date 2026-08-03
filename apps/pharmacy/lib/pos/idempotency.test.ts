import { beforeEach, describe, expect, it, vi } from "vitest"

const maybeSingle = vi.fn()
const upsert = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
      upsert,
    })),
  },
}))

import {
  findSaleIdempotency,
  readIdempotencyKey,
  storeSaleIdempotency,
} from "./idempotency"

describe("readIdempotencyKey", () => {
  it("prefers Idempotency-Key header", () => {
    const req = new Request("https://example.com", {
      headers: { "Idempotency-Key": "  abc-123  " },
    })
    expect(readIdempotencyKey(req, { idempotencyKey: "body-key" })).toBe("abc-123")
  })

  it("falls back to body field", () => {
    const req = new Request("https://example.com")
    expect(readIdempotencyKey(req, { idempotencyKey: "body-key" })).toBe("body-key")
  })

  it("rejects oversized keys", () => {
    const req = new Request("https://example.com", {
      headers: { "Idempotency-Key": "x".repeat(200) },
    })
    expect(readIdempotencyKey(req, null)).toBeNull()
  })
})

describe("findSaleIdempotency / storeSaleIdempotency", () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    upsert.mockReset()
  })

  it("returns prior sale payload on retry", async () => {
    maybeSingle.mockResolvedValue({
      data: { sale_id: "sale-1", response_payload: { id: "sale-1", receipt_number: "R-1" } },
      error: null,
    })
    const prior = await findSaleIdempotency("tenant-1", "key-1")
    expect(prior).toEqual({
      saleId: "sale-1",
      response: { id: "sale-1", receipt_number: "R-1" },
    })
  })

  it("returns null when key is new", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await findSaleIdempotency("tenant-1", "fresh")).toBeNull()
  })

  it("fails open when table is missing", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "relation does not exist" } })
    expect(await findSaleIdempotency("tenant-1", "key")).toBeNull()
  })

  it("upserts with tenant+key conflict target", async () => {
    upsert.mockResolvedValue({ error: null })
    await storeSaleIdempotency({
      tenantId: "t1",
      key: "k1",
      userId: "u1",
      saleId: "s1",
      response: { id: "s1" },
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "t1",
        idempotency_key: "k1",
        sale_id: "s1",
      }),
      expect.objectContaining({ onConflict: "tenant_id,idempotency_key" }),
    )
  })
})
