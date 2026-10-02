// Real-concurrency tests against a LOCAL Supabase (PostgREST -> Postgres).
// Skipped unless LOCAL_API_URL/LOCAL_SERVICE_ROLE_KEY point at 127.0.0.1/localhost.
// Run: source <env with supabase status -o env> && node --test scripts/db-tests/pharmacy-concurrency.local.test.mjs
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const URL_ = process.env.LOCAL_API_URL ?? ""
const KEY = process.env.LOCAL_SERVICE_ROLE_KEY ?? ""
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(URL_) && KEY.length > 0
const skip = isLocal ? false : "local Supabase env not set (LOCAL_API_URL / LOCAL_SERVICE_ROLE_KEY)"
const db = isLocal ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null

let tenantId = ""
let cashierId = ""
const created = { products: [], customers: [], sessions: [] }
const today = new Date().toISOString().slice(0, 10)
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)

async function product(qty, label) {
  const { data: p, error } = await db.from("pharmacy_products").insert({
    tenant_id: tenantId, name: `ZZ conc ${label} ${randomUUID().slice(0, 6)}`, sku: `ZZC-${randomUUID().slice(0, 8)}`,
    price: 1000, cost_price: 500, quantity: qty, category: "General", unit_of_measure: "Tablet",
  }).select("id").single()
  if (error) throw error
  if (qty > 0) {
    const { error: be } = await db.from("pharmacy_product_batches").insert({
      tenant_id: tenantId, product_id: p.id, batch_number: `ZZB-${randomUUID().slice(0, 6)}`, quantity: qty,
      initial_quantity: qty, expiry_date: inDays(300), received_date: today, cost_price: 500, is_active: true, status: "active",
    })
    if (be) throw be
  }
  created.products.push(p.id)
  return p.id
}

const sell = (productId, quantity, extra = {}) =>
  db.rpc("complete_pharmacy_sale", {
    p_tenant_id: tenantId, p_cashier_id: cashierId, p_items: [{ product_id: productId, quantity, unit_price: 1000 }],
    p_payment_method: "CASH", p_session_id: null, p_cart_id: null, p_payment_ref: null, p_discount_total: 0,
    p_tax_amount: 0, p_patient_id: null, p_confirmed_by: cashierId, p_idempotency_key: null, ...extra,
  })

describe("pharmacy concurrency (local Postgres)", { skip }, () => {
  before(async () => {
    const { data: t } = await db.from("tenants").select("id, name").ilike("name", "ZZ Synthetic Pharmacy%").order("created_at").limit(1).maybeSingle()
    assert.ok(t, "needs a local ZZ Synthetic Pharmacy tenant")
    tenantId = t.id
    const { data: prof } = await db.from("profiles").select("id").eq("tenant_id", tenantId).limit(1).single()
    cashierId = prof.id
  })

  after(async () => {
    // Synthetic rows stay for audit; products are deactivated so they do not pollute the catalogue.
    if (created.products.length) await db.from("pharmacy_products").update({ is_active: false }).in("id", created.products)
  })

  it("last unit: two concurrent cashiers each sell 1 of stock 1 -> exactly one succeeds", async () => {
    const pid = await product(1, "last-unit")
    const [a, b] = await Promise.all([sell(pid, 1), sell(pid, 1)])
    const ok = [a, b].filter((r) => !r.error)
    const failed = [a, b].filter((r) => r.error)
    assert.equal(ok.length, 1, "exactly one sale commits")
    assert.equal(failed.length, 1)
    assert.match(failed[0].error.message, /^INSUFFICIENT_STOCK/)
    const { data: p } = await db.from("pharmacy_products").select("quantity").eq("id", pid).single()
    assert.equal(p.quantity, 0)
    const { data: neg } = await db.from("pharmacy_product_batches").select("id").eq("product_id", pid).eq("batch_number", "NEG-STOCK")
    assert.equal(neg.length, 0, "no NEG-STOCK overdraft batch")
  })

  it("oversell (99,999 of stock 5) is rejected and stock is untouched", async () => {
    const pid = await product(5, "oversell")
    const r = await sell(pid, 99999)
    assert.ok(r.error)
    assert.match(r.error.message, /^INSUFFICIENT_STOCK/)
    const { data: p } = await db.from("pharmacy_products").select("quantity").eq("id", pid).single()
    assert.equal(p.quantity, 5)
  })

  it("duplicate retry with the same idempotency key creates one sale", async () => {
    const pid = await product(10, "idem")
    const key = `zz-idem-${randomUUID()}`
    const rs = await Promise.all([1, 2, 3].map(() => sell(pid, 2, { p_idempotency_key: key })))
    const ok = rs.filter((r) => !r.error)
    assert.ok(ok.length >= 1)
    const saleIds = new Set(ok.map((r) => r.data.sale_id))
    assert.equal(saleIds.size, 1, "all successful replies point at one sale")
    for (const r of rs.filter((x) => x.error)) assert.match(r.error.message, /IDEMPOTENCY_IN_PROGRESS/)
    const { data: p } = await db.from("pharmacy_products").select("quantity").eq("id", pid).single()
    assert.equal(p.quantity, 8, "stock decremented once")
  })
})
