#!/usr/bin/env node
// Local billing variants beyond the golden journey: lab-only visit with a cancelled test and a
// rejected-specimen replacement, unpriced services, charges after payment, and a no-charge visit.
import { randomUUID } from "node:crypto"
import { assertLocalTargets, loginAs, Report, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const r = new Report("billing-variants")
const TENANT_A = "cd6f9771-2479-4236-b9ba-16985b3ef6d4"
const stamp = Date.now().toString(36)
const PRICE = { consult: 10000, FBC: 15000, "Malaria RDT": 8000 }

const reception = await loginAs("receptionist")
const doctor = await loginAs("doctor")
const tech = await loginAs("lab_technician")
const scientist = await loginAs("lab_scientist")
const cashier = await loginAs("billing_officer")

async function newVisit(label) {
  const reg = await reception.call("POST", "/api/patients/register", { full_name: `Billing ${label} ${stamp}`, sex: "F", dob: "1990-06-01", phone: `0702${String(Date.now()).slice(-6)}` })
  r.expectStatus(`${label}.register`, reg, 201)
  const visit = await reception.call("POST", "/api/opd/triage", { patient_id: reg.json?.patient?.id, chief_complaint: `Billing ${label}` })
  r.expectStatus(`${label}.visit`, visit, 201)
  return { patientId: reg.json?.patient?.id, encounterId: visit.json?.encounterId }
}
const order = async (v, test_name, loinc_code, extra = {}) => {
  const res = await doctor.call("POST", "/api/opd/lab-orders", { encounter_id: v.encounterId, patient_id: v.patientId, loinc_code, test_name, urgency: "ROUTINE", ...extra })
  return { res, id: res.json?.orderId }
}
const lab = (session, orderId, action, extra = {}) => session.call("POST", "/api/lab/actions", { orderId, action, ...extra })
async function runLab(orderId, value) {
  for (const [s, action] of [[tech, "collect"], [tech, "receive"], [tech, "enter_result"], [scientist, "verify"], [scientist, "release"]]) {
    const res = await lab(s, orderId, action, { value, accessionNumber: `BV-${orderId.slice(0, 8)}` })
    if (res.status !== 200) return res
  }
  return { status: 200 }
}
const invoiceOf = async (encounterId) => (await cashier.call("GET", `/api/hospital/billing/encounter/${encounterId}`)).json
const openTasks = (encounterId) => sqlJson(`select task_type, status from department_tasks where encounter_id='${encounterId}' and status in ('REQUESTED','ACCEPTED','IN_PROGRESS','ON_HOLD')`)

// 1. Lab-only visit: one completed test, one cancelled test, one rejected specimen + replacement.
const v1 = await newVisit("lab_only")
const fbc = await order(v1, "FBC", "58410-2")
const cancelled = await order(v1, "FBC", "58410-2")
const rdt = await order(v1, "Malaria RDT", "70569-9")
r.check("lab_only.orders_created", [fbc, cancelled, rdt].every((o) => o.res.status === 201))
r.expectStatus("lab_only.cancel", await doctor.call("POST", `/api/lab/orders/${cancelled.id}/cancel`, { reason: "Duplicate order" }), 200)
r.expectStatus("lab_only.fbc_complete", await runLab(fbc.id, "WBC 5.9"), 200)
r.expectStatus("lab_only.rdt_collect", await lab(tech, rdt.id, "collect", { accessionNumber: `BV-R-${stamp}` }), 200)
r.expectStatus("lab_only.rdt_reject", await lab(tech, rdt.id, "reject", { reason: "insufficient_volume" }), 200)
const replacement = await order(v1, "Malaria RDT", "70569-9", { replaces_lab_order_id: rdt.id })
r.expectStatus("lab_only.replacement_order", replacement.res, 201)
r.expectStatus("lab_only.second_replacement_refused", (await order(v1, "Malaria RDT", "70569-9", { replaces_lab_order_id: rdt.id })).res, 409)
r.expectStatus("lab_only.replacement_complete", await runLab(replacement.id, "Negative"), 200)
for (const id of sqlJson(`select id from lab_results where lab_order_id in ('${fbc.id}','${replacement.id}')`).map((x) => x.id)) {
  await doctor.call("POST", `/api/opd/results/${id}/review`)
}
r.expectStatus("lab_only.sign", await doctor.call("POST", `/api/opd/encounters/${v1.encounterId}/sign`), 200)
const inv1 = await invoiceOf(v1.encounterId)
const lines1 = (inv1?.lineItems ?? []).map((l) => `${l.item_name}=${Number(l.total_price ?? l.unit_price * l.qty)}`)
const expected1 = PRICE.consult + PRICE.FBC + PRICE["Malaria RDT"]
r.check("lab_only.cancelled_test_not_billed", (inv1?.lineItems ?? []).filter((l) => /FBC/.test(l.item_name)).length === 1, lines1.join(" | "))
r.check("lab_only.recollection_billed_once", (inv1?.lineItems ?? []).filter((l) => /Malaria/.test(l.item_name)).length === 1, lines1.join(" | "))
r.check("lab_only.no_pharmacy_lines", !(inv1?.lineItems ?? []).some((l) => /Dispense/.test(l.item_name)), lines1.join(" | "))
r.check("lab_only.total", Number(inv1?.invoice?.total_amount) === expected1, `total=${inv1?.invoice?.total_amount} expected=${expected1}`)
const pay1 = await cashier.call("POST", `/api/hospital/billing/encounter/${v1.encounterId}/pay`, { amount: Number(inv1?.invoice?.total_amount), payment_method: "cash", idempotency_key: `bv-${randomUUID()}` })
r.expectStatus("lab_only.pay_full", pay1, [200, 201])
r.check("lab_only.paid", pay1.json?.payment?.status === "paid", JSON.stringify(pay1.json))
r.check("lab_only.no_open_tasks", openTasks(v1.encounterId).length === 0, JSON.stringify(openTasks(v1.encounterId)))

// 2. Charges attempted after the invoice is paid must not silently disappear.
const late = await order(v1, "FBC", "58410-2")
const inv1After = await invoiceOf(v1.encounterId)
const lateVisible = late.res.status >= 400 || JSON.stringify(late.res.json ?? {}).includes("INVOICE_LOCKED") || (inv1After?.warnings ?? []).some((w) => /LOCKED|late/i.test(w))
r.check("late_charge.refused_or_flagged", lateVisible, `HTTP ${late.res.status} ${JSON.stringify(late.res.json).slice(0, 200)} warnings=${JSON.stringify(inv1After?.warnings)}`)
r.check("late_charge.paid_invoice_unchanged", Number(inv1After?.invoice?.total_amount) === expected1 && inv1After?.invoice?.status === "paid")
if (late.id) await doctor.call("POST", `/api/lab/orders/${late.id}/cancel`, { reason: "Acceptance cleanup" })

// 3. Unpriced service: ordered, flagged, never billed at zero.
const v3 = await newVisit("unpriced")
const unpriced = await order(v3, `Acceptance Unpriced Assay ${stamp}`, "99999-9")
r.expectStatus("unpriced.order", unpriced.res, 201)
r.check("unpriced.warning_on_order", JSON.stringify(unpriced.res.json ?? {}).includes("SERVICE_PRICE_NOT_CONFIGURED"), JSON.stringify(unpriced.res.json).slice(0, 200))
const inv3 = await invoiceOf(v3.encounterId)
r.check("unpriced.not_billed", !(inv3?.lineItems ?? []).some((l) => l.item_name.includes("Unpriced")), JSON.stringify(inv3?.lineItems))
r.check("unpriced.warning_on_invoice", (inv3?.warnings ?? []).some((w) => w.startsWith("SERVICE_PRICE_NOT_CONFIGURED")), JSON.stringify(inv3?.warnings))
await doctor.call("POST", `/api/lab/orders/${unpriced.id}/cancel`, { reason: "Acceptance cleanup" })

// 4. No-charge visit (consultation priced at zero, e.g. government facility).
const consultRow = sqlJson(`select id, price from service_catalog where tenant_id='${TENANT_A}' and service_type='consultation' and name ilike '%OPD%' and is_active limit 1`)[0]
try {
  sql(`update service_catalog set price=0 where id='${consultRow.id}'`)
  const v4 = await newVisit("no_charge")
  r.expectStatus("no_charge.sign", await doctor.call("POST", `/api/opd/encounters/${v4.encounterId}/sign`), 200)
  const inv4 = await invoiceOf(v4.encounterId)
  const total4 = Number(inv4?.invoice?.total_amount ?? 0)
  r.check("no_charge.zero_total", total4 === 0, JSON.stringify(inv4?.invoice))
  const pay4 = await cashier.call("POST", `/api/hospital/billing/encounter/${v4.encounterId}/pay`, { amount: 0.01, payment_method: "cash", idempotency_key: `bv-${randomUUID()}` })
  r.check("no_charge.payment_not_required", pay4.status === 409 || pay4.status === 404, `HTTP ${pay4.status} ${JSON.stringify(pay4.json)}`)
  r.check("no_charge.no_payment_rows", Number(sql(`select count(*) from billing_payments where encounter_id='${v4.encounterId}'`)) === 0)
  const tasks4 = openTasks(v4.encounterId)
  r.check("no_charge.no_open_billing_task", !tasks4.some((t) => t.task_type === "billing"), JSON.stringify(tasks4))
  r.check("no_charge.invoice_state", !inv4?.invoice || ["paid", "void"].includes(inv4.invoice.status) || total4 === 0, JSON.stringify(inv4?.invoice))
} finally {
  sql(`update service_catalog set price=${Number(consultRow.price)} where id='${consultRow.id}'`)
}

process.exit(r.summary() ? 0 : 1)
