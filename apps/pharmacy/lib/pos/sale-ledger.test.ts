import { describe, expect, it, vi } from "vitest"

// Columns that actually exist on public.pharmacy_transactions (local + prod, 2026-10-02).
const TX_COLUMNS = new Set([
  "cashier_id", "client_address", "client_name", "client_phone", "created_at", "customer_id",
  "discount", "id", "is_edited", "net_amount", "notes", "payment_method", "status", "tax",
  "tenant_id", "total_amount", "transaction_no", "updated_at",
])

const selects: Record<string, string> = {}

function chain(table: string) {
  const rows =
    table === "pharmacy_transactions"
      ? [{ id: "t1", transaction_no: "TX-1", status: "COMPLETED", total_amount: 1200, discount: 200, tax: 0, net_amount: 1000, created_at: "2026-10-02T10:00:00Z", items: [] }]
      : []
  const q: any = {
    select: (s: string) => ((selects[table] = s), q),
    eq: () => q, in: () => q, gte: () => q, lte: () => q, order: () => q, limit: () => q,
    then: (res: (v: unknown) => unknown) => {
      const s = selects[table] ?? ""
      const top = s.replace(/\([^()]*(\([^()]*\)[^()]*)*\)/g, "").split(",").map((c) => c.trim()).filter((c) => c && !c.includes(":"))
      const bad = table === "pharmacy_transactions" ? top.filter((c) => !TX_COLUMNS.has(c)) : []
      return Promise.resolve(
        bad.length ? { data: null, error: { message: `column pharmacy_transactions.${bad[0]} does not exist` } } : { data: rows, error: null },
      ).then(res)
    },
  }
  return q
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: (t: string) => chain(t) } }))

import { listLedgerSalesForHistory } from "./sale-ledger"

describe("listLedgerSalesForHistory", () => {
  it("only selects columns that exist on pharmacy_transactions and returns order sales", async () => {
    const rows = await listLedgerSalesForHistory({ tenantId: "tenant-1" })
    const order = rows.filter((r) => r.source === "order")
    expect(order).toHaveLength(1)
    expect(order[0]).toMatchObject({ transactionNo: "TX-1", netAmount: 1000, subtotal: 1200, discount: 200 })
  })
})
