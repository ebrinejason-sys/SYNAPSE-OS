#!/usr/bin/env node
// Persisted local golden journey: reception → nurse → doctor (ICD-11) → lab → pharmacy → billing.
// Runs against a local Next.js server and the local Supabase container only.
import { randomUUID } from "node:crypto"
import { assertLocalTargets, loginAs, Report, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const TENANT_A = "cd6f9771-2479-4236-b9ba-16985b3ef6d4"
const PARA_PRODUCT = "012b627b-4cb0-402b-a017-1f64f8344b55"
const r = new Report("golden-journey")
const stamp = Date.now().toString(36)

function stock() {
  return Number(sql(`select coalesce(sum(quantity),0) from pharmacy_product_batches where product_id='${PARA_PRODUCT}' and is_active`))
}

// Reception: register, duplicate warning, open visit without triage.
const reception = await loginAs("receptionist")
const patientName = `Golden Rtwo ${stamp}`
const reg = await reception.call("POST", "/api/patients/register", { full_name: patientName, sex: "F", dob: "1991-04-12", phone: `0700${stamp.slice(-6)}` })
r.expectStatus("reception.register", reg, 201)
const patientId = reg.json?.patient?.id

const dup = await reception.call("POST", "/api/patients/register", { full_name: patientName.toUpperCase(), sex: "F", dob: "1991-04-12" })
r.expectStatus("reception.duplicate.warns", dup, 409)
r.check("reception.duplicate.candidate", dup.json?.candidates?.some((c) => c.id === patientId), dup.json)
const dupOverride = await reception.call("POST", "/api/patients/register", {
  full_name: patientName, sex: "F", dob: "1991-04-12", duplicate_override_reason: "Acceptance: twin with same name",
})
r.expectStatus("reception.duplicate.create_anyway", dupOverride, 201)
const overrideAudit = sqlJson(`select new_value->'duplicate_override' as o from audit_log where table_name='patients' and record_id='${dupOverride.json?.patient?.id}'`)
r.check("reception.duplicate.audited", overrideAudit[0]?.o?.candidate_patient_ids?.includes(patientId), overrideAudit)

const acuityDenied = await reception.call("POST", "/api/opd/triage", { patient_id: patientId, chief_complaint: "Fever", clinical_stage: "RED" })
r.expectStatus("reception.triage_acuity.denied", acuityDenied, 403)
const visit = await reception.call("POST", "/api/opd/triage", { patient_id: patientId, chief_complaint: "Fever and headache for 3 days" })
r.expectStatus("reception.visit.create", visit, 201)
const encounterId = visit.json?.encounterId
r.expectStatus("reception.sign.denied", await reception.call("POST", `/api/opd/encounters/${encounterId}/sign`), 403)
r.expectStatus("reception.diagnose.denied", await reception.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "1F40" }), 403)

// Nurse: queue, vitals + acuity on the existing visit.
const nurse = await loginAs("nurse")
const nurseQueue = await nurse.call("GET", "/api/opd/queue")
r.expectStatus("nurse.queue.read", nurseQueue, 200)
const vitals = await nurse.call("POST", "/api/opd/vitals", {
  encounter_id: encounterId, patient_id: patientId, temperature_c: 38.2, heart_rate: 96, bp_systolic: 118, bp_diastolic: 74, spo2: 97, respiratory_rate: 20, clinical_stage: "YELLOW",
})
r.expectStatus("nurse.vitals", vitals, 201)
r.check("nurse.vitals.no_journey_warnings", !vitals.json?.journeyWarnings, vitals.json)
r.check("nurse.acuity.persisted", sql(`select clinical_stage from encounters where id='${encounterId}'`) === "YELLOW")
const tasks = sqlJson(`select task_type, status from department_tasks where encounter_id='${encounterId}' order by created_at`)
r.check("nurse.triage_task.completed", tasks.some((t) => t.task_type === "triage" && t.status === "COMPLETED"), tasks)
r.check("nurse.doctor_task.created", tasks.filter((t) => t.task_type === "consultation").length === 1, tasks)
r.expectStatus("nurse.sign.denied", await nurse.call("POST", `/api/opd/encounters/${encounterId}/sign`), 403)
r.expectStatus("nurse.diagnose.denied", await nurse.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "1F40" }), 403)
r.expectStatus("nurse.prescribe.denied", await nurse.call("POST", "/api/opd/prescriptions", {
  encounter_id: encounterId, patient_id: patientId, medication_display: "Paracetamol 500mg", dose: "1 tab", quantity: 1, unit: "tablet",
}), 403)

// Doctor: queue, write-up, ICD-11, labs, prescription.
const doctor = await loginAs("doctor")
const docQueue = await doctor.call("GET", "/api/opd/queue")
r.expectStatus("doctor.queue.read", docQueue, 200)
r.check("doctor.queue.contains_visit", JSON.stringify(docQueue.json).includes(encounterId), "encounter missing from queue")
r.expectStatus("doctor.writeup", await doctor.call("PUT", `/api/opd/encounters/${encounterId}/write-up`, {
  hpi: "Fever and headache for 3 days", pmh: "None", medications: "None", allergies: "NKDA", familySocial: "Non-smoker",
  ros: "No chest pain", examination: "Febrile 38.2C", assessment: "Likely malaria", plan: "RDT, FBC, paracetamol",
}), [200, 201])
const dx = await doctor.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "1F40" })
r.expectStatus("doctor.icd11.create", dx, 201)
const dxRetry = await doctor.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "1F40" })
r.check("doctor.icd11.retry_idempotent", dxRetry.status === 200 && dxRetry.json?.idempotent === true, dxRetry)
r.expectStatus("doctor.icd11.unknown_rejected", await doctor.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "ZZ99" }), 422)
const dxRows = sqlJson(`select stem_code, icd_release, selected_by from encounter_diagnoses where encounter_id='${encounterId}' and not is_deleted`)
r.check("doctor.icd11.persisted_once", dxRows.length === 1 && dxRows[0].stem_code === "1F40" && dxRows[0].icd_release, dxRows)

const orderIds = []
for (const [loinc, name, urgency] of [["58410-2", "FBC", "ROUTINE"], ["70569-9", "Malaria RDT", "STAT"]]) {
  const res = await doctor.call("POST", "/api/opd/lab-orders", { encounter_id: encounterId, patient_id: patientId, loinc_code: loinc, test_name: name, urgency })
  r.expectStatus(`doctor.lab_order.${name}`, res, 201)
  orderIds.push(res.json?.orderId)
}
const rx = await doctor.call("POST", "/api/opd/prescriptions", {
  encounter_id: encounterId, patient_id: patientId, medication_display: "Paracetamol 500mg", dose: "1 tablet TID x 3 days", quantity: 9, unit: "tablet",
})
r.expectStatus("doctor.prescribe", rx, [200, 201])
const prescriptionId = rx.json?.prescriptionId

// Lab: technician collects/receives/enters; scientist verifies/releases.
const tech = await loginAs("lab_technician")
for (const orderId of orderIds) {
  r.expectStatus(`lab.collect.${orderId.slice(0, 8)}`, await tech.call("POST", "/api/lab/actions", { orderId, action: "collect", accessionNumber: `R2-${orderId.slice(0, 8)}` }), 200)
  r.expectStatus(`lab.receive.${orderId.slice(0, 8)}`, await tech.call("POST", "/api/lab/actions", { orderId, action: "receive" }), 200)
  r.expectStatus(`lab.enter.${orderId.slice(0, 8)}`, await tech.call("POST", "/api/lab/actions", { orderId, action: "enter_result", value: orderId === orderIds[1] ? "Positive" : "WBC 6.2" }), 200)
}
r.expectStatus("lab.technician.verify.denied", await tech.call("POST", "/api/lab/actions", { orderId: orderIds[0], action: "verify" }), 403)

const scientist = await loginAs("lab_scientist")
for (const orderId of orderIds) {
  r.expectStatus(`lab.verify.${orderId.slice(0, 8)}`, await scientist.call("POST", "/api/lab/actions", { orderId, action: "verify" }), 200)
  r.expectStatus(`lab.release.${orderId.slice(0, 8)}`, await scientist.call("POST", "/api/lab/actions", { orderId, action: "release" }), 200)
}
const releaseEvents = () => Number(sql(`select count(*) from audit_log where record_id='${orderIds[0]}' and new_value::text ilike '%RELEASED%'`))
const timelineEvents = () => Number(sql(`select count(*) from patient_timeline_events where source_id in (select id from lab_results where lab_order_id='${orderIds[0]}') or source_id='${orderIds[0]}'`))
const beforeAudit = releaseEvents()
const beforeTimeline = timelineEvents()
const rerelease = await scientist.call("POST", "/api/lab/actions", { orderId: orderIds[0], action: "release" })
r.check("lab.release.repeat_safe", rerelease.status < 500, rerelease)
r.check("lab.release.repeat_no_dup_audit", releaseEvents() === beforeAudit, { before: beforeAudit, after: releaseEvents() })
r.check("lab.release.repeat_no_dup_timeline", timelineEvents() === beforeTimeline, { before: beforeTimeline, after: timelineEvents() })

// Doctor: review results, sign, disposition (+ retries).
await doctor.login("doctor.e2e@synapseos.invalid")
const labView = await doctor.call("GET", `/api/opd/lab-orders?encounter_id=${encounterId}`)
r.expectStatus("doctor.lab_orders.read", labView, 200)
const resultIds = sqlJson(`select id from lab_results where lab_order_id in ('${orderIds.join("','")}')`).map((x) => x.id)
r.check("lab.results.persisted", resultIds.length === 2, resultIds)
for (const id of resultIds) r.expectStatus(`doctor.result_review.${id.slice(0, 8)}`, await doctor.call("POST", `/api/opd/results/${id}/review`), 200)
const reviewRetry = await doctor.call("POST", `/api/opd/results/${resultIds[0]}/review`)
r.check("doctor.result_review.retry", reviewRetry.status === 200 && reviewRetry.json?.alreadyReviewed === true, reviewRetry)
const sign = await doctor.call("POST", `/api/opd/encounters/${encounterId}/sign`)
r.expectStatus("doctor.sign", sign, 200)
const signRetry = await doctor.call("POST", `/api/opd/encounters/${encounterId}/sign`)
r.check("doctor.sign.retry_safe", [200, 409].includes(signRetry.status), signRetry)
r.check("doctor.sign.single_audit", Number(sql(`select count(*) from audit_log where record_id='${encounterId}' and action ilike '%sign%'`)) <= 1,
  sql(`select string_agg(action, ',') from audit_log where record_id='${encounterId}'`))
const disp = await doctor.call("POST", `/api/opd/encounters/${encounterId}/disposition`, { disposition: "LOCAL_PHARMACY" })
r.expectStatus("doctor.disposition", disp, [200, 201])
const dispRetry = await doctor.call("POST", `/api/opd/encounters/${encounterId}/disposition`, { disposition: "LOCAL_PHARMACY" })
r.check("doctor.disposition.retry_safe", dispRetry.status < 500, dispRetry)
r.expectStatus("doctor.diagnose_after_sign.blocked", await doctor.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "CA40" }), 409)

// Pharmacy: dispense once, retry is rejected, stock moves once.
const pharmacist = await loginAs("pharmacist")
const stockBefore = stock()
const dispense = await pharmacist.call("POST", "/api/hospital/pharmacy/dispense", {
  prescription_id: prescriptionId, product_id: PARA_PRODUCT, pharmacy_tenant_id: TENANT_A, payment_method: "cash",
})
r.expectStatus("pharmacy.dispense", dispense, [200, 201])
const dispenseRetry = await pharmacist.call("POST", "/api/hospital/pharmacy/dispense", {
  prescription_id: prescriptionId, product_id: PARA_PRODUCT, pharmacy_tenant_id: TENANT_A, payment_method: "cash",
})
r.expectStatus("pharmacy.dispense.retry_rejected", dispenseRetry, 409)
r.check("pharmacy.stock.decremented_once", stockBefore - stock() === 9, { stockBefore, after: stock() })
r.expectStatus("pharmacy.sign.denied", await pharmacist.call("POST", `/api/opd/encounters/${encounterId}/sign`), 403)

// Billing: partial, idempotent retry, overpayment, final, receipts.
const cashier = await loginAs("billing_officer")
const inv = await cashier.call("GET", `/api/hospital/billing/encounter/${encounterId}`)
r.expectStatus("billing.invoice.read", inv, 200)
const total = Number(inv.json?.invoice?.total_amount ?? 0)
const alreadyPaid = Number(inv.json?.invoice?.paid_amount ?? 0)
const lineSum = (inv.json?.lineItems ?? []).reduce((s, l) => s + Number(l.total_price ?? Number(l.qty ?? 0) * Number(l.unit_price ?? 0)), 0)
r.check("billing.invoice.total_matches_lines", total > 0 && Math.abs(total - lineSum) < 0.01, { total, lineSum })
const names = (inv.json?.lineItems ?? []).map((l) => l.item_name).join(" | ")
r.check("billing.invoice.lines", /consult/i.test(names) && /FBC/i.test(names) && /Malaria/i.test(names) && /Paracetamol/i.test(names), names)
const balance = total - alreadyPaid
const part = Math.round((balance / 2) * 100) / 100
const key = `r2-${randomUUID()}`
const pay1 = await cashier.call("POST", `/api/hospital/billing/encounter/${encounterId}/pay`, { amount: part, payment_method: "cash", idempotency_key: key })
r.expectStatus("billing.partial", pay1, [200, 201])
const pay1Retry = await cashier.call("POST", `/api/hospital/billing/encounter/${encounterId}/pay`, { amount: part, payment_method: "cash", idempotency_key: key })
r.check("billing.partial.retry_idempotent", pay1Retry.status < 300 && pay1Retry.json?.payment?.receiptNumber === pay1.json?.payment?.receiptNumber, pay1Retry)
const over = await cashier.call("POST", `/api/hospital/billing/encounter/${encounterId}/pay`, { amount: balance, payment_method: "cash", idempotency_key: `r2-${randomUUID()}` })
r.expectStatus("billing.overpayment.rejected", over, 409)
const pay2 = await cashier.call("POST", `/api/hospital/billing/encounter/${encounterId}/pay`, {
  amount: Math.round((balance - part) * 100) / 100, payment_method: "mobile_money", payment_ref: "MM-R2", idempotency_key: `r2-${randomUUID()}`,
})
r.expectStatus("billing.final", pay2, [200, 201])
r.check("billing.final.paid", pay2.json?.payment?.status === "paid", pay2.json)
const receipts = [pay1.json?.payment?.receiptNumber, pay2.json?.payment?.receiptNumber]
r.check("billing.receipts.distinct", receipts.every((x) => /^RCP-/.test(x ?? "")) && receipts[0] !== receipts[1], receipts)
const afterPaid = await cashier.call("POST", `/api/hospital/billing/encounter/${encounterId}/pay`, { amount: 1, payment_method: "cash", idempotency_key: `r2-${randomUUID()}` })
r.expectStatus("billing.after_paid.rejected", afterPaid, 409)
r.expectStatus("billing.cashier.sign.denied", await cashier.call("POST", `/api/opd/encounters/${encounterId}/sign`), 403)
r.expectStatus("billing.cashier.diagnose.denied", await cashier.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "1F40" }), 403)

// Data integrity graph.
const inv2 = sqlJson(`select id, total_amount, paid_amount, status from billing_invoices where encounter_id='${encounterId}'`)
r.check("integrity.single_invoice", inv2.length === 1, inv2)
const paySum = Number(sql(`select coalesce(sum(amount),0) from billing_payments where invoice_id='${inv2[0]?.id}'`))
r.check("integrity.payments_sum_total", Math.abs(paySum - Number(inv2[0]?.total_amount)) < 0.01 && inv2[0]?.status === "paid", { paySum, inv: inv2[0] })
r.check("integrity.payment_count", Number(sql(`select count(*) from billing_payments where invoice_id='${inv2[0]?.id}'`)) === 2)
const graph = sqlJson(`select
  (select count(*) from encounters where id='${encounterId}' and patient_id='${patientId}' and tenant_id='${TENANT_A}') as enc,
  (select count(*) from vitals where encounter_id='${encounterId}' and tenant_id='${TENANT_A}') as vitals,
  (select count(*) from lab_orders where encounter_id='${encounterId}' and patient_id='${patientId}' and tenant_id='${TENANT_A}') as orders,
  (select count(*) from lab_results lr join lab_orders lo on lo.id=lr.lab_order_id where lo.encounter_id='${encounterId}' and lr.tenant_id=lo.tenant_id) as results,
  (select count(*) from clinical_prescriptions where id='${prescriptionId}' and encounter_id='${encounterId}' and status='dispensed') as rx_dispensed,
  (select count(*) from encounters where id='${encounterId}' and is_signed) as signed`)
r.check("integrity.graph", JSON.stringify(graph[0]) === JSON.stringify({ enc: 1, vitals: 1, orders: 2, results: 2, rx_dispensed: 1, signed: 1 }), graph[0])

// Audit integrity: every journey audit row carries tenant and actor.
const audit = sqlJson(`select table_name, count(*) as n, count(*) filter (where tenant_id is null or user_id is null) as missing
  from audit_log where created_at > now() - interval '30 minutes' and (record_id in ('${encounterId}','${patientId}','${prescriptionId}','${orderIds.join("','")}') or new_value::text like '%${encounterId}%')
  group by table_name order by table_name`)
r.check("audit.rows_present", audit.length >= 4, audit)
r.check("audit.tenant_and_actor", audit.every((a) => Number(a.missing) === 0), audit)

console.log(JSON.stringify({ patientId, encounterId, orderIds, prescriptionId, receipts }))
process.exit(r.summary() ? 0 : 1)
