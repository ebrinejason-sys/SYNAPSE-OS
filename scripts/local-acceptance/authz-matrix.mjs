#!/usr/bin/env node
// Local authorization + CSRF matrix: clinical officer role, Hospital A → B isolation, cross-origin mutations.
import { randomUUID } from "node:crypto"
import { assertLocalTargets, BASE, EMAILS, loginAs, Report, Session, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const r = new Report("authz-matrix")
const TENANT_A = "cd6f9771-2479-4236-b9ba-16985b3ef6d4"
const TENANT_B = "73821071-f2a8-40e0-91c1-7803cbfca9e4"
const HOSPITAL_B = "25673ddb-00de-4529-9f12-4beed8362b58"
const stamp = Date.now().toString(36)

// Synthetic Hospital B fixtures (local DB only).
const B = {
  dept: randomUUID(), ward: randomUUID(), bed: randomUUID(), service: randomUUID(), patient: randomUUID(), encounter: randomUUID(),
  staff: sql(`select id from profiles where lower(email)='${EMAILS.doctor_b}'`),
}
sql(`insert into departments (id, name, tenant_id, hospital_id, is_active) values ('${B.dept}', 'B Dept ${stamp}', '${TENANT_B}', '${HOSPITAL_B}', true);
insert into wards (id, hospital_id, name, is_active) values ('${B.ward}', '${HOSPITAL_B}', 'B Ward ${stamp}', true);
insert into hospital_beds (id, hospital_id, bed_number, ward) values ('${B.bed}', '${HOSPITAL_B}', 'B-${stamp}', 'B Ward ${stamp}');
insert into service_catalog (id, name, tenant_id) values ('${B.service}', 'B Service ${stamp}', '${TENANT_B}');
insert into patients (id, mrn, full_name, sex, tenant_id, hospital_id, is_deleted, is_synthetic) values ('${B.patient}', 'B-${stamp}', 'Isolation B ${stamp}', 'F', '${TENANT_B}', '${HOSPITAL_B}', false, true);
insert into encounters (id, tenant_id, hospital_id, patient_id, chief_complaint, status, visit_date, is_deleted) values ('${B.encounter}', '${TENANT_B}', '${HOSPITAL_B}', '${B.patient}', 'Isolation check', 'open', now(), false);`)
const bSnapshot = () => sql(`select md5(string_agg(x, '|')) from (
  select row(d.*)::text x from departments d where id='${B.dept}' union all select row(w.*)::text from wards w where id='${B.ward}'
  union all select row(h.*)::text from hospital_beds h where id='${B.bed}' union all select row(s.*)::text from service_catalog s where id='${B.service}'
  union all select row(e.*)::text from encounters e where id='${B.encounter}' union all select row(p.role, p.tenant_id, p.department_id)::text from profiles p where id='${B.staff}') t`)
const before = bSnapshot()

// Hospital A admin cannot mutate Hospital B.
const adminA = await loginAs("hospital_admin")
const adminCases = [
  ["staff.patch", "PATCH", `/api/hospital/admin/staff/${B.staff}`, { role: "nurse" }],
  ["department.patch", "PATCH", `/api/hospital/admin/departments/${B.dept}`, { name: "pwned" }],
  ["department.delete", "DELETE", `/api/hospital/admin/departments/${B.dept}`],
  ["service.patch", "PATCH", `/api/hospital/admin/services/${B.service}`, { name: "pwned" }],
  ["service.delete", "DELETE", `/api/hospital/admin/services/${B.service}`],
  ["ward.patch", "PATCH", `/api/hospital/admin/wards/${B.ward}`, { name: "pwned" }],
  ["ward.delete", "DELETE", `/api/hospital/admin/wards/${B.ward}`],
  ["bed.patch", "PATCH", `/api/hospital/admin/beds/${B.bed}`, { bed_number: "pwned" }],
  ["bed.delete", "DELETE", `/api/hospital/admin/beds/${B.bed}`],
]
for (const [id, method, path, body] of adminCases) {
  r.expectStatus(`hospital.a_to_b.admin.${id}`, await adminA.call(method, path, body), [403, 404])
}
const deptA = sql(`select id from departments where hospital_id='4bf8bcf0-c771-4375-b262-4913509a6666' limit 1`)
const staffA = sql(`select id from profiles where lower(email)='${EMAILS.nurse}'`)
r.expectStatus("hospital.a_to_b.admin.assign_foreign_department", await adminA.call("PATCH", `/api/hospital/admin/staff/${staffA}`, { department_id: B.dept }), [403, 404])

// Hospital A clinicians cannot read or mutate a Hospital B encounter/patient.
const doctorA = await loginAs("doctor")
const clinicalCases = [
  ["encounter.sign", "POST", `/api/opd/encounters/${B.encounter}/sign`],
  ["encounter.diagnose", "POST", `/api/opd/encounters/${B.encounter}/diagnoses`, { stem_code: "1F40" }],
  ["encounter.diagnoses.read", "GET", `/api/opd/encounters/${B.encounter}/diagnoses`],
  ["encounter.writeup", "PUT", `/api/opd/encounters/${B.encounter}/write-up`, { hpi: "x", assessment: "x", plan: "x" }],
  ["encounter.disposition", "POST", `/api/opd/encounters/${B.encounter}/disposition`, { disposition: "NO_MEDICATION" }],
  ["billing.read", "GET", `/api/hospital/billing/encounter/${B.encounter}`],
  ["timeline.read", "GET", `/api/hospital/timeline/encounter/${B.encounter}`],
  ["lab_order.create", "POST", "/api/opd/lab-orders", { encounter_id: B.encounter, patient_id: B.patient, loinc_code: "58410-2", test_name: "FBC", urgency: "ROUTINE" }],
  ["prescription.create", "POST", "/api/opd/prescriptions", { encounter_id: B.encounter, patient_id: B.patient, medication_display: "X", dose: "1", quantity: 1, unit: "tab" }],
  ["triage.open_visit", "POST", "/api/opd/triage", { patient_id: B.patient, chief_complaint: "cross tenant" }],
]
for (const [id, method, path, body] of clinicalCases) {
  const res = await doctorA.call(method, path, body)
  r.check(`hospital.a_to_b.clinical.${id}`, [400, 403, 404, 409, 422].includes(res.status), `HTTP ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`)
}
const aSearch = await doctorA.call("GET", `/api/patients/search?q=${encodeURIComponent(`Isolation B ${stamp}`)}`)
r.check("hospital.a_to_b.patient.search_hidden", (aSearch.json?.patients ?? []).length === 0, aSearch)
r.check("hospital.a_to_b.no_rows_changed", bSnapshot() === before, "Hospital B fixture changed")
r.check("hospital.a_to_b.no_foreign_writes", Number(sql(`select
  (select count(*) from encounters where patient_id='${B.patient}' and tenant_id <> '${TENANT_B}') +
  (select count(*) from lab_orders where encounter_id='${B.encounter}') +
  (select count(*) from clinical_prescriptions where encounter_id='${B.encounter}') +
  (select count(*) from encounter_diagnoses where encounter_id='${B.encounter}')`)) === 0)

// Hospital B doctor cannot touch a Hospital A encounter.
const encA = sql(`select id from encounters where tenant_id='${TENANT_A}' order by created_at desc limit 1`)
const doctorB = await loginAs("doctor_b", EMAILS.doctor_b)
for (const [id, method, path, body] of [
  ["sign", "POST", `/api/opd/encounters/${encA}/sign`],
  ["diagnoses.read", "GET", `/api/opd/encounters/${encA}/diagnoses`],
  ["billing.read", "GET", `/api/hospital/billing/encounter/${encA}`],
  ["pay", "POST", `/api/hospital/billing/encounter/${encA}/pay`, { amount: 1, payment_method: "cash" }],
]) {
  const res = await doctorB.call(method, path, body)
  r.check(`hospital.b_to_a.${id}`, [403, 404, 409].includes(res.status), `HTTP ${res.status}`)
}

// Clinical officer: authorized clinician (role swapped on the synthetic doctor, restored in finally).
const doctorId = sql(`select id from profiles where lower(email)='${EMAILS.doctor}'`)
try {
  sql(`update profiles set role='clinical_officer' where id='${doctorId}'`)
  const reception = await loginAs("receptionist")
  const reg = await reception.call("POST", "/api/patients/register", { full_name: `CO Journey ${stamp}`, sex: "M", dob: "1985-02-02" })
  const patientId = reg.json?.patient?.id
  const visit = await reception.call("POST", "/api/opd/triage", { patient_id: patientId, chief_complaint: "Cough" })
  const encounterId = visit.json?.encounterId
  const nurse = await loginAs("nurse")
  await nurse.call("POST", "/api/opd/vitals", { encounter_id: encounterId, patient_id: patientId, temperature_c: 37.9, clinical_stage: "GREEN" })
  const co = await loginAs("doctor")
  r.expectStatus("clinical_officer.queue", await co.call("GET", "/api/opd/queue"), 200)
  r.expectStatus("clinical_officer.writeup", await co.call("PUT", `/api/opd/encounters/${encounterId}/write-up`, { hpi: "Cough 2 days", examination: "Clear chest", assessment: "URTI", plan: "Supportive" }), [200, 201])
  r.expectStatus("clinical_officer.diagnose", await co.call("POST", `/api/opd/encounters/${encounterId}/diagnoses`, { stem_code: "CA40" }), 201)
  r.expectStatus("clinical_officer.prescribe", await co.call("POST", "/api/opd/prescriptions", { encounter_id: encounterId, patient_id: patientId, medication_display: "Paracetamol 500mg", dose: "1 tab TID", quantity: 6, unit: "tablet" }), [200, 201])
  r.expectStatus("clinical_officer.sign", await co.call("POST", `/api/opd/encounters/${encounterId}/sign`), 200)
  r.expectStatus("clinical_officer.disposition", await co.call("POST", `/api/opd/encounters/${encounterId}/disposition`, { disposition: "LOCAL_PHARMACY" }), [200, 201])
  r.expectStatus("clinical_officer.lab_verify.denied", await co.call("POST", "/api/lab/actions", { orderId: randomUUID(), action: "verify" }), [403, 404])
} finally {
  sql(`update profiles set role='doctor' where id='${doctorId}'`)
}

// Role separation spot checks.
const cashier = await loginAs("billing_officer")
r.expectStatus("rbac.cashier.register.denied", await cashier.call("POST", "/api/patients/register", { full_name: `Cashier ${stamp}`, sex: "F" }), 403)
r.expectStatus("rbac.cashier.admin_staff.denied", await cashier.call("PATCH", `/api/hospital/admin/staff/${staffA}`, { role: "doctor" }), 403)
const nurse = await loginAs("nurse")
r.expectStatus("rbac.nurse.pay.denied", await nurse.call("POST", `/api/hospital/billing/encounter/${encA}/pay`, { amount: 1, payment_method: "cash" }), 403)
r.expectStatus("rbac.nurse.admin_staff.denied", await nurse.call("PATCH", `/api/hospital/admin/staff/${staffA}`, { role: "doctor" }), 403)
r.expectStatus("rbac.nurse.lab_release.denied", await nurse.call("POST", "/api/lab/actions", { orderId: randomUUID(), action: "release" }), [403, 404])

// Hospital staff cannot route or dispense against another tenant's pharmacy stock.
const PHARM_A = "00000000-0000-4000-8000-0000000002a0"
const pharmStock = () => sql(`select coalesce(sum(quantity),0) || ':' || (select count(*) from pharmacy_pos_sales where tenant_id='${PHARM_A}') from pharmacy_product_batches where tenant_id='${PHARM_A}'`)
const pharmBefore = pharmStock()
const pharmacist = await loginAs("pharmacist")
const foreignProduct = sql(`select id from pharmacy_products where tenant_id='${PHARM_A}' limit 1`) || randomUUID()
r.expectStatus("hospital.pharmacy.dispense_foreign_tenant.denied", await pharmacist.call("POST", "/api/hospital/pharmacy/dispense", {
  prescription_id: randomUUID(), product_id: foreignProduct, pharmacy_tenant_id: PHARM_A, payment_method: "cash",
}), 403)
r.expectStatus("hospital.prescription.route_foreign_pharmacy.denied", await doctorA.call("POST", "/api/opd/prescriptions", {
  encounter_id: encA, patient_id: randomUUID(), medication_display: "X", dose: "1", quantity: 1, unit: "tab", pharmacy_tenant_id: PHARM_A,
}), 403)
r.check("hospital.pharmacy.foreign_stock_unchanged", pharmStock() === pharmBefore)

// CSRF: live cross-origin mutations with a valid staff session.
const victim = await loginAs("receptionist")
const setCookie = await (async () => {
  const s = new Session("cookie-probe")
  sql(`delete from public.auth_otps where target='${EMAILS.receptionist}'`)
  await s.call("POST", "/api/auth/password-login", { email: EMAILS.receptionist, password: process.env.SYNAPSE_E2E_PASSWORD })
  const res = await fetch(`${BASE}/api/auth/email-otp/verify`, {
    method: "POST", headers: { "content-type": "application/json", cookie: s.cookie(), origin: BASE },
    body: JSON.stringify({ email: EMAILS.receptionist, otp: process.env.SYNAPSE_E2E_FIXED_OTP }),
  })
  return (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("synapse_session=")) ?? ""
})()
r.check("csrf.cookie.httponly", /;\s*httponly/i.test(setCookie), setCookie.replace(/=[^;]+/, "=<redacted>"))
r.check("csrf.cookie.samesite_lax_or_strict", /;\s*samesite=(lax|strict)/i.test(setCookie), setCookie.replace(/=[^;]+/, "=<redacted>"))
r.check("csrf.cookie.host_only", !/;\s*domain=/i.test(setCookie), setCookie.replace(/=[^;]+/, "=<redacted>"))

const body = { full_name: `CSRF ${stamp}`, sex: "F" }
const blocked = (res) => res.status === 403 && res.json?.error === "cross_origin_mutation_blocked"
r.check("csrf.cross_site_json", blocked(await victim.call("POST", "/api/patients/register", body, { origin: "https://evil.example" })), "not blocked")
r.check("csrf.sibling_subdomain", blocked(await victim.call("POST", "/api/patients/register", body, { origin: "https://evil.synapseos.tech" })), "not blocked")
r.check("csrf.cross_site_form", blocked(await victim.call("POST", "/api/patients/register", "full_name=x&sex=F", { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" })), "not blocked")
r.check("csrf.text_plain_form", blocked(await victim.call("POST", "/api/patients/register", JSON.stringify(body), { origin: "null", "content-type": "text/plain" })), "not blocked")
r.check("csrf.cross_referer_no_origin", blocked(await victim.call("POST", "/api/patients/register", body, { origin: "", referer: "https://evil.example/x" })), "not blocked")
r.check("csrf.sec_fetch_site_cross", blocked(await victim.call("POST", "/api/patients/register", body, { origin: "", "sec-fetch-site": "cross-site" })), "not blocked")
r.expectStatus("csrf.same_origin_allowed", await victim.call("POST", "/api/patients/register", body), [201, 409])
r.check("csrf.no_patient_from_blocked", Number(sql(`select count(*) from patients where full_name='x'`)) === 0)

process.exit(r.summary() ? 0 : 1)
