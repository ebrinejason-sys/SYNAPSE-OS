#!/usr/bin/env node
// Local standalone Pharmacy acceptance: purchasing → receive → FEFO POS → payments/credit →
// physical stock → history, with retry idempotency and Pharmacy A → B isolation.
import { randomUUID } from "node:crypto"
import { assertLocalTargets, pharmacyLogin, PHARM_BASE, Report, Session, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const r = new Report("pharmacy-acceptance")
const PHARM_A = "00000000-0000-4000-8000-0000000002a0"
const PHARM_B = "00000000-0000-4000-8000-0000000003b0"
const stamp = Date.now().toString(36)

sql(`insert into tenant_subscriptions (tenant_id, plan_id, status, starts_at, current_period_start, current_period_end)
select t, (select id from subscription_plans where slug='synapse_pharmacy_annual'), 'active', now(), now(), now() + interval '1 year'
from unnest(array['${PHARM_A}'::uuid, '${PHARM_B}'::uuid]) t
where not exists (select 1 from tenant_subscriptions s where s.tenant_id = t and s.status in ('active','trialing'));`)

const stock = (productId) => Number(sql(`select coalesce(sum(quantity),0) from pharmacy_product_batches where product_id='${productId}' and is_active`))
const batches = (productId) => sqlJson(`select batch_number, quantity, expiry_date from pharmacy_product_batches where product_id='${productId}' and is_active order by expiry_date`)

const manager = await pharmacyLogin("pharm.mgr.a.e2e@synapseos.invalid", "manager_a")
const cashier = await pharmacyLogin("pharm.cashier.a.e2e@synapseos.invalid", "cashier_a")
const managerB = await pharmacyLogin("pharm.mgr.b.e2e@synapseos.invalid", "manager_b")
r.check("login.manager", manager.jar.has("synapse_session"))
r.check("login.cashier", cashier.jar.has("synapse_session"))

// Supplier + new product + catalogue update.
const supplier = await manager.call("POST", "/api/admin/suppliers", { name: `Acceptance Supplier ${stamp}`, phone: "+256700000000" })
r.expectStatus("supplier.create", supplier, [200, 201])
const supplierId = supplier.json?.id ?? supplier.json?.supplier?.id
const product = await manager.call("POST", "/api/admin/inventory", {
  name: `Amoxicillin 500mg ${stamp}`, sku: `AMX500-${stamp}`, price: 500, costPrice: 300, strength: "500mg", dosageForm: "Capsule", unitOfMeasure: "Capsule",
})
r.expectStatus("product.create", product, [200, 201])
const productId = product.json?.id
r.check("product.create.no_phantom_stock", stock(productId) === 0, `stock=${stock(productId)}`)
const update = await manager.call("PATCH", "/api/admin/inventory", { id: productId, name: `Amoxicillin 500mg Caps ${stamp}`, price: 550, costPrice: 300, strength: "500mg", dosageForm: "Capsule" })
r.expectStatus("product.update", update, 200)
const qtyEdit = await manager.call("PATCH", "/api/admin/inventory", { id: productId, name: "x", price: 550, quantity: 9999 })
r.check("product.update.quantity_edit_refused", qtyEdit.status >= 400 && stock(productId) === 0, `HTTP ${qtyEdit.status}`)

// Purchase with immediate receipt; replaying the same purchase must not double stock.
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const purchaseBody = {
  idempotencyKey: randomUUID(), supplierId, supplierInvoiceNo: `INV-${stamp}`, receiveNow: true, paymentStatus: "paid", paymentMethod: "cash", amountPaid: 9000,
  lines: [
    { productId, quantity: 10, costPrice: 300, sellingPrice: 550, batchNumber: `LATE-${stamp}`, expiryDate: future(400) },
    { productId, quantity: 20, costPrice: 300, sellingPrice: 550, batchNumber: `EARLY-${stamp}`, expiryDate: future(120) },
  ],
}
const purchase = await manager.call("POST", "/api/admin/purchases", purchaseBody)
r.expectStatus("purchase.create_and_receive", purchase, [200, 201])
r.check("purchase.stock_received", stock(productId) === 30, `stock=${stock(productId)}`)
const replay = await manager.call("POST", "/api/admin/purchases", purchaseBody)
r.check("purchase.replay_no_double_stock", stock(productId) === 30 && replay.status < 500, `HTTP ${replay.status} stock=${stock(productId)}`)
const purchaseRows = sqlJson(`select id, supplier_id from pharmacy_purchases where tenant_id='${PHARM_A}' and supplier_invoice_no='INV-${stamp}'`)
r.check("purchase.single_row", purchaseRows.length === 1, JSON.stringify(purchaseRows))
r.check("purchase.supplier_linked", purchaseRows[0]?.supplier_id === supplierId)
const purchaseId = purchaseRows[0]?.id ?? randomUUID()

// Direct receipt with a batch; replay with the same batch must not silently double.
const receiveBody = { productId, batchNumber: `RCV-${stamp}`, quantity: 5, expiryDate: future(600), costPrice: 300, supplierId, reason: "Acceptance receipt" }
r.expectStatus("receive.batch", await manager.call("POST", "/api/admin/inventory/receive", receiveBody), [200, 201])
r.check("receive.stock_added", stock(productId) === 35, `stock=${stock(productId)}`)
const expired = await manager.call("POST", "/api/admin/inventory/receive", { ...receiveBody, batchNumber: `EXP-${stamp}`, expiryDate: "2020-01-01" })
r.check("receive.expired_batch_refused", expired.status >= 400 && stock(productId) === 35, `HTTP ${expired.status}`)
r.expectStatus("rbac.cashier.receive.denied", await cashier.call("POST", "/api/admin/inventory/receive", { ...receiveBody, batchNumber: `CSH-${stamp}` }), [401, 403])

// POS: open till, FEFO cash sale, idempotent retry, partial payment, credit sale.
const till = await cashier.call("POST", "/api/admin/till/open", { openingFloat: 1000 })
r.check("till.open", till.status === 200 || /already/i.test(JSON.stringify(till.json)), `HTTP ${till.status} ${JSON.stringify(till.json).slice(0, 160)}`)
const saleKey = randomUUID()
const cashSale = { items: [{ productId, quantity: 3 }], paymentMethod: "cash", amountPaid: 2000, idempotencyKey: saleKey }
const sale1 = await cashier.call("POST", "/api/admin/pos/complete-sale", cashSale, { "idempotency-key": saleKey })
r.expectStatus("pos.cash_sale", sale1, 200)
r.check("pos.fefo_earliest_expiry_first", batches(productId).find((b) => b.batch_number === `EARLY-${stamp}`)?.quantity === 17, JSON.stringify(batches(productId)))
r.check("pos.change_computed", Number(sale1.json?.settlement?.change) === 2000 - 3 * 550, JSON.stringify(sale1.json?.settlement))
const receipt = sale1.json?.sale?.receipt_number
r.check("pos.receipt_number", typeof receipt === "string" && receipt.length > 0, JSON.stringify(sale1.json?.sale ?? {}).slice(0, 200))
const sale1Retry = await cashier.call("POST", "/api/admin/pos/complete-sale", cashSale, { "idempotency-key": saleKey })
r.check("pos.retry_idempotent", sale1Retry.status === 200 && sale1Retry.json?.idempotentReplay === true && stock(productId) === 32, `HTTP ${sale1Retry.status} stock=${stock(productId)} ${JSON.stringify(sale1Retry.json).slice(0, 300)}`)
const priceTamper = await cashier.call("POST", "/api/admin/pos/complete-sale", { items: [{ productId, quantity: 1, unitPrice: 1 }], paymentMethod: "cash" })
r.check("pos.client_price_ignored_or_refused", priceTamper.status >= 400 || Number(sql(`select unit_price from pharmacy_pos_sale_items where product_id='${productId}' order by created_at desc limit 1`)) === 550, `HTTP ${priceTamper.status}`)

const partialNoCustomer = await cashier.call("POST", "/api/admin/pos/complete-sale", { items: [{ productId, quantity: 2 }], paymentMethod: "cash", amountPaid: 500 })
r.check("pos.partial_requires_customer", partialNoCustomer.status === 400 && partialNoCustomer.json?.code === "CUSTOMER_REQUIRED_FOR_BALANCE")
const stockBeforePartial = stock(productId)
const partial = await cashier.call("POST", "/api/admin/pos/complete-sale", { items: [{ productId, quantity: 2 }], paymentMethod: "cash", amountPaid: 500, clientName: `Balance Customer ${stamp}`, clientPhone: `+2567${String(Date.now()).slice(-8)}` })
r.expectStatus("pos.partial_payment", partial, 200)
r.check("pos.partial_balance_due", Number(partial.json?.settlement?.balanceDue) === 2 * 550 - 500, JSON.stringify(partial.json?.settlement))
r.check("pos.partial_stock_decremented", stock(productId) === stockBeforePartial - 2)
const creditCustomer = partial.json?.settlement?.customerId
r.check("credit.ledger_entry_for_balance", Number(sql(`select count(*) from pharmacy_credit_ledger where customer_id='${creditCustomer}' and amount=600`)) === 1)
const creditSale = await cashier.call("POST", "/api/admin/pos/complete-sale", { items: [{ productId, quantity: 1 }], paymentMethod: "CREDIT", customerId: creditCustomer })
r.expectStatus("pos.credit_sale", creditSale, 200)
r.check("credit.balance_accumulates", Number(creditSale.json?.settlement?.balanceAfter) === 600 + 550, JSON.stringify(creditSale.json?.settlement))
r.check("audit.underpayment_logged", Number(sql(`select count(*) from pharmacy_audit_logs where tenant_id='${PHARM_A}' and action='POS_UNDERPAYMENT' and created_at > now() - interval '10 minutes'`)) >= 1)
r.expectStatus("rbac.cashier.customer_delete.denied", await cashier.call("DELETE", `/api/admin/customers?id=${creditCustomer}`), 403)
r.expectStatus("customer.delete_with_credit_history.refused", await manager.call("DELETE", `/api/admin/customers?id=${creditCustomer}`), 409)
r.check("customer.still_present", Number(sql(`select count(*) from pharmacy_customers where id='${creditCustomer}'`)) === 1)

// Physical count sets absolute stock with a reason; history records every movement.
const counted = await manager.call("POST", "/api/admin/inventory/physical-stock", { productId, physicalQty: 25, reason: "Acceptance cycle count" })
r.expectStatus("physical_stock.count", counted, 200)
r.check("physical_stock.absolute_quantity", stock(productId) === 25, `stock=${stock(productId)}`)
const history = await manager.call("GET", `/api/admin/inventory/product-history?productId=${productId}`)
r.expectStatus("history.read", history, 200)
r.check("history.has_movements", JSON.stringify(history.json ?? {}).length > 50)
r.check("integrity.no_negative_batches", Number(sql(`select count(*) from pharmacy_product_batches where tenant_id='${PHARM_A}' and quantity < 0`)) === 0)
const search = await cashier.call("GET", `/api/admin/inventory?search=${encodeURIComponent(`Amoxicillin 500mg Caps ${stamp}`)}`)
r.check("search.finds_product", JSON.stringify(search.json ?? {}).includes(productId), `HTTP ${search.status}`)

// Pharmacy A → B isolation: B's manager cannot read or change A's records.
const customerA = creditCustomer
const aSnapshot = () => sql(`select md5(concat_ws('|',
  (select row(p.*)::text from pharmacy_products p where p.id='${productId}'),
  (select row(s.*)::text from pharmacy_suppliers s where s.id='${supplierId}'),
  (select row(c.*)::text from pharmacy_customers c where c.id='${customerA}'),
  (select sum(quantity)::text from pharmacy_product_batches where product_id='${productId}'),
  (select count(*)::text from pharmacy_credit_ledger where customer_id='${customerA}')))`)
const before = aSnapshot()
const crossCases = [
  ["product.patch", "PATCH", "/api/admin/inventory", { id: productId, name: "pwned", price: 1 }],
  ["product.delete", "DELETE", `/api/admin/inventory?id=${productId}`],
  ["product.receive", "POST", "/api/admin/inventory/receive", { productId, batchNumber: `X-${stamp}`, quantity: 100, expiryDate: future(300) }],
  ["product.physical", "POST", "/api/admin/inventory/physical-stock", { productId, physicalQty: 0, reason: "pwned" }],
  ["product.history", "GET", `/api/admin/inventory/product-history?productId=${productId}`],
  ["supplier.patch", "PATCH", "/api/admin/suppliers", { id: supplierId, name: "pwned" }],
  ["supplier.delete", "DELETE", `/api/admin/suppliers?id=${supplierId}`],
  ["customer.patch", "PATCH", "/api/admin/customers", { id: customerA, name: "pwned" }],
  ["customer.delete", "DELETE", `/api/admin/customers?id=${customerA}`],
  ["credit.post", "POST", "/api/admin/credit-ledger", { customerId: customerA, type: "payment", amount: 1650 }],
  ["purchase.read", "GET", `/api/admin/purchases/${purchaseId}`],
  ["purchase.patch", "PATCH", `/api/admin/purchases/${purchaseId}`, { notes: "pwned" }],
  ["sale.cross_product", "POST", "/api/admin/pos/complete-sale", { items: [{ productId, quantity: 1 }], paymentMethod: "cash" }],
]
for (const [id, method, path, body] of crossCases) {
  const res = await managerB.call(method, path, body)
  const leaked = method === "GET" && res.status === 200 && JSON.stringify(res.json ?? {}).includes(productId)
  r.check(`pharmacy.a_to_b.${id}`, !leaked && (method === "GET" ? res.status !== 500 : res.status >= 400), `HTTP ${res.status} ${JSON.stringify(res.json).slice(0, 160)}`)
}
for (const [id, path] of [["customers", "/api/admin/customers"], ["inventory", "/api/admin/inventory"], ["suppliers", "/api/admin/suppliers"], ["orders", "/api/admin/orders"], ["inquiries", "/api/admin/inquiries"], ["users", "/api/admin/users"], ["purchases", "/api/admin/purchases"], ["credit", "/api/admin/credit-ledger"]]) {
  const res = await managerB.call("GET", path)
  const body = JSON.stringify(res.json ?? {})
  r.check(`pharmacy.a_to_b.list.${id}`, ![productId, supplierId, customerA, purchaseId, "pharm.mgr.a.e2e", "pharm.cashier.a.e2e"].some((v) => v && body.includes(v)), `HTTP ${res.status}`)
}
r.check("pharmacy.a_to_b.no_rows_changed", aSnapshot() === before, "Pharmacy A records changed")

// Hospital-side cross-origin and anonymous probes.
r.check("pharmacy.anonymous.admin_denied", [401, 403, 307, 302].includes((await new Session("anon", PHARM_BASE).call("GET", "/api/admin/inventory")).status))
const csrf = await manager.call("POST", "/api/admin/inventory/receive", receiveBody, { origin: "https://evil.example" })
r.check("pharmacy.csrf.cross_origin_blocked", csrf.status === 403 && csrf.json?.error === "cross_origin_mutation_blocked", `HTTP ${csrf.status}`)

process.exit(r.summary() ? 0 : 1)
