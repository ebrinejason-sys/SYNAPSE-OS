#!/usr/bin/env node
// Local Lab acceptance beyond the golden journey: lifecycle order enforcement, collect retry,
// specimen rejection and recollection, amendment audit, role separation and Hospital A → B isolation.
import { assertLocalTargets, EMAILS, loginAs, loginHospitalBAs, Report, restoreHospitalB, Session, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const r = new Report("lab-acceptance")
const stamp = Date.now().toString(36)

const orderStatus = (id) => sql(`select coalesce(workflow_status, upper(status)) from lab_orders where id='${id}'`)
const specimens = (id) => sqlJson(`select status, condition from lab_specimens where lab_order_id='${id}' order by created_at`)

// Setup: a fresh visit with two lab orders.
const reception = await loginAs("receptionist")
const patientName = `Lab Rtwo ${stamp}`
const reg = await reception.call("POST", "/api/patients/register", { full_name: patientName, sex: "M", dob: "1985-02-03", phone: `0701${stamp.slice(-6)}` })
r.expectStatus("setup.register", reg, 201)
const patientId = reg.json?.patient?.id
const visit = await reception.call("POST", "/api/opd/triage", { patient_id: patientId, chief_complaint: "Lab acceptance" })
r.expectStatus("setup.visit", visit, 201)
const encounterId = visit.json?.encounterId

const doctor = await loginAs("doctor")
const orderIds = []
for (const [loinc, name] of [["58410-2", "FBC"], ["70569-9", "Malaria RDT"]]) {
  const res = await doctor.call("POST", "/api/opd/lab-orders", { encounter_id: encounterId, patient_id: patientId, loinc_code: loinc, test_name: name, urgency: "ROUTINE" })
  r.expectStatus(`setup.order.${name}`, res, 201)
  orderIds.push(res.json?.orderId)
}
const [fbc, rdt] = orderIds

const tech = await loginAs("lab_technician")
const scientist = await loginAs("lab_scientist")
const act = (session, orderId, action, extra = {}) => session.call("POST", "/api/lab/actions", { orderId, action, ...extra })

// Lifecycle order is enforced server-side.
for (const [id, session, action] of [
  ["release_before_verify", scientist, "release"],
  ["verify_before_result", scientist, "verify"],
  ["enter_before_collect", tech, "enter_result"],
  ["receive_before_collect", tech, "receive"],
]) {
  const res = await act(session, fbc, action, { value: "x" })
  r.check(`lifecycle.${id}.refused`, res.status >= 400 && res.status < 500 && orderStatus(fbc) === "ORDERED", `HTTP ${res.status} status=${orderStatus(fbc)}`)
}

// Collect retry never allocates a second specimen.
r.expectStatus("collect", await act(tech, fbc, "collect", { accessionNumber: `LAB-${stamp}` }), 200)
r.expectStatus("collect.retry", await act(tech, fbc, "collect", { accessionNumber: `LAB-${stamp}-2` }), 200)
r.check("collect.retry.single_specimen", specimens(fbc).length === 1, JSON.stringify(specimens(fbc)))
r.expectStatus("receive", await act(tech, fbc, "receive"), 200)
r.expectStatus("enter_result", await act(tech, fbc, "enter_result", { value: "WBC 7.1" }), 200)

// Role separation: technician and ordering doctor cannot sign off results.
for (const action of ["verify", "release", "amend"]) {
  r.expectStatus(`rbac.technician.${action}.denied`, await act(tech, fbc, action, { value: "WBC 9.9", reason: "x" }), 403)
}
r.expectStatus("rbac.doctor.verify.denied", await act(doctor, fbc, "verify"), 403)
r.check("rbac.no_state_change", orderStatus(fbc) !== "VERIFIED" && orderStatus(fbc) !== "RELEASED", orderStatus(fbc))

r.expectStatus("verify", await act(scientist, fbc, "verify"), 200)
r.check("verify.verified_by_scientist", sql(`select verified_by from lab_results where lab_order_id='${fbc}' order by created_at desc limit 1`) === sql(`select id from profiles where email='${EMAILS.lab_scientist}'`))
r.expectStatus("release", await act(scientist, fbc, "release"), 200)

// Amendment after release is audited once and keeps the original.
const amend = await act(scientist, fbc, "amend", { value: "WBC 7.4", reason: "Transcription error" })
r.expectStatus("amend", amend, 200)
r.check("amend.audited", Number(sql(`select count(*) from audit_log where record_id='${fbc}' and action='LAB_RESULT_AMENDED'`)) === 1)
const amendRows = sqlJson(`select value, result_value, status, version from lab_results where lab_order_id='${fbc}' order by created_at`)
r.check("amend.value_visible", JSON.stringify(amendRows).includes("7.4"), JSON.stringify(amendRows))

// Specimen rejection, then recollection on the same order.
r.expectStatus("reject.collect", await act(tech, rdt, "collect", { accessionNumber: `RDT-${stamp}` }), 200)
r.expectStatus("reject", await act(tech, rdt, "reject", { reason: "hemolyzed", note: "Haemolysed sample" }), 200)
r.check("reject.order_status", orderStatus(rdt) === "REJECTED", orderStatus(rdt))
r.check("reject.specimen_marked", specimens(rdt)[0]?.status === "rejected" && specimens(rdt)[0]?.condition === "hemolyzed", JSON.stringify(specimens(rdt)))
r.check("reject.reason_on_order", sql(`select rejection_reason from lab_orders where id='${rdt}'`) === "hemolyzed")
r.expectStatus("reject.verify_refused", await act(scientist, rdt, "verify"), 400)
r.expectStatus("reject.same_order_recollect_refused", await act(tech, rdt, "collect", { accessionNumber: `RDT-${stamp}-R` }), 400)
const replacement = await doctor.call("POST", "/api/opd/lab-orders", { encounter_id: encounterId, patient_id: patientId, loinc_code: "70569-9", test_name: "Malaria RDT", urgency: "ROUTINE" })
r.expectStatus("recollect.replacement_order", replacement, 201)
r.expectStatus("recollect.replacement_collect", await act(tech, replacement.json?.orderId, "collect", { accessionNumber: `RDT-${stamp}-R` }), 200)
r.check("recollect.new_specimen", specimens(replacement.json?.orderId)[0]?.status === "collected" && specimens(rdt).length === 1, JSON.stringify(specimens(replacement.json?.orderId)))

// Hospital A → B: B's lab staff can neither act on nor read A's orders.
const snapshot = () => sql(`select md5(concat_ws('|',
  (select string_agg(row(o.*)::text, ',' order by o.id) from lab_orders o where o.id in ('${fbc}','${rdt}')),
  (select string_agg(row(x.*)::text, ',' order by x.id) from lab_results x where x.lab_order_id in ('${fbc}','${rdt}')),
  (select string_agg(row(s.*)::text, ',' order by s.id) from lab_specimens s where s.lab_order_id in ('${fbc}','${rdt}'))))`)
const before = snapshot()
const aResultId = sql(`select id from lab_results where lab_order_id='${fbc}' order by created_at desc limit 1`)
// Entitle Hospital B to Lab for this section so denials come from tenant scoping, not the plan gate.
const HOSPITAL_B = "73821071-f2a8-40e0-91c1-7803cbfca9e4"
const bPlan = sql(`select plan_id from tenant_subscriptions where tenant_id='${HOSPITAL_B}'`)
sql(`update tenant_subscriptions set plan_id=(select id from subscription_plans where slug='synapse_os_lab_addon_annual') where tenant_id='${HOSPITAL_B}'`)
try {
  const labTechB = await loginHospitalBAs("lab_technician")
  const bWorklist = await labTechB.call("GET", "/api/lab/worklist")
  r.check("hospital_b.lab_entitled", bWorklist.status === 200, `HTTP ${bWorklist.status} ${JSON.stringify(bWorklist.json).slice(0, 160)}`)
  await crossHospital(labTechB, ["collect", "receive", "enter_result", "reject"])
  r.check("hospital.a_to_b.specimens_list", !leaks(await labTechB.call("GET", "/api/lab/specimens")))
  const labSciB = await loginHospitalBAs("lab_scientist")
  await crossHospital(labSciB, ["verify", "release", "amend", "acknowledge"])
  r.expectStatus("hospital.a_to_b.cancel", await labSciB.call("POST", `/api/lab/orders/${rdt}/cancel`, { reason: "pwned" }), [403, 404])
  for (const [id, method, path] of [
    ["critical_ack", "POST", `/api/lab/results/${aResultId}/critical-ack`],
    ["trend", "GET", `/api/lab/results/${aResultId}/trend`],
    ["report", "GET", `/api/lab/reports/${fbc}`],
    ["worklist", "GET", "/api/lab/worklist"],
    ["verify_queue", "GET", "/api/lab/verify-queue"],
    ["results_list", "GET", "/api/lab/results"],
  ]) {
    const res = await labSciB.call(method, path)
    r.check(`hospital.a_to_b.${id}`, !leaks(res) && (method === "GET" || res.status >= 400), `HTTP ${res.status}`)
  }
} finally {
  restoreHospitalB()
  sql(`update tenant_subscriptions set plan_id='${bPlan}' where tenant_id='${HOSPITAL_B}'`)
}
r.check("hospital.a_to_b.no_rows_changed", snapshot() === before, "Hospital A lab rows changed")

async function crossHospital(session, actions) {
  for (const action of actions) {
    for (const orderId of [fbc, rdt]) {
      const res = await act(session, orderId, action, { value: "pwned", reason: "hemolyzed", accessionNumber: `B-${stamp}` })
      r.check(`hospital.a_to_b.${action}.${orderId === fbc ? "fbc" : "rdt"}`, res.status >= 400 && ![402, 500].includes(res.status), `HTTP ${res.status} ${JSON.stringify(res.json).slice(0, 120)}`)
    }
  }
}

function leaks(res) {
  const body = JSON.stringify(res.json ?? {})
  return res.status === 500 || [fbc, rdt, patientId, patientName, `LAB-${stamp}`, "7.4"].some((v) => body.includes(v))
}

// Anonymous and cross-origin.
r.expectStatus("anonymous.denied", await act(new Session("anon"), fbc, "verify"), 401)
const csrf = await scientist.call("POST", "/api/lab/actions", { orderId: rdt, action: "receive" }, { origin: "https://evil.example" })
r.check("csrf.cross_origin_blocked", csrf.status === 403, `HTTP ${csrf.status}`)

console.log(JSON.stringify({ patientId, encounterId, orderIds }))
process.exit(r.summary() ? 0 : 1)
