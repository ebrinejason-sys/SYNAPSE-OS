#!/usr/bin/env node
/**
 * Idempotent synthetic OS E2E fixture.
 *
 * Requires:
 *   SYNAPSE_E2E_SEED=true
 *   SYNAPSE_E2E_PASSWORD=...
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     or: npx supabase projects api-keys --project-ref <ref>
 *
 * Does not print the password.
 */
import { createHash, randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const bcrypt = require("bcryptjs")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const FACILITY_A = "synapse-e2e-hospital"
const FACILITY_B = "synapse-e2e-hospital-b"
const ROLES_A = [
  "receptionist",
  "nurse",
  "doctor",
  "lab_tech",
  "lab_scientist",
  "pharmacist",
  "billing_officer",
  "hospital_admin",
]

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : null
}

function emailFor(role, facility = "a") {
  return `e2e.${role}.${facility}@synapseos.invalid`
}

if (process.env.SYNAPSE_E2E_SEED !== "true") {
  console.error("Refusing to seed. Set SYNAPSE_E2E_SEED=true")
  process.exit(1)
}

const password = process.env.SYNAPSE_E2E_PASSWORD?.trim()
if (!password || password.length < 12) {
  console.error("SYNAPSE_E2E_PASSWORD must be set (12+ characters). It will not be printed.")
  process.exit(1)
}

const projectRef = argValue("--project-ref") || process.env.SUPABASE_PROJECT_REF || "qfqakzmjatszisuqjwon"
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`).trim()
let key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
if (!key) {
  const raw = execFileSync("npx", ["supabase", "projects", "api-keys", "--project-ref", projectRef, "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const keys = JSON.parse(raw)
  const service = keys.find((row) => row.name === "service_role" || row.id === "service_role")
  if (!service?.api_key) {
    console.error("service_role key not found")
    process.exit(1)
  }
  key = service.api_key
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const passwordHash = await bcrypt.hash(password, 12)

async function ensureTenant(slug, name) {
  const { data: existing, error } = await db.from("tenants").select("id,slug").eq("slug", slug).maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) {
    await db.from("tenants").update({
      is_synthetic: true,
      environment: "e2e",
      data_classification: "synthetic",
      status: "active",
      lifecycle_status: "ACTIVE",
      facility_type: "hospital",
    }).eq("id", existing.id)
    return existing
  }
  const id = randomUUID()
  const ins = await db.from("tenants").insert({
    id,
    slug,
    name,
    country_code: "UG",
    facility_type: "hospital",
    status: "active",
    is_synthetic: true,
    environment: "e2e",
    data_classification: "synthetic",
    lifecycle_status: "ACTIVE",
    plan: "trial",
  }).select("id,slug").single()
  if (ins.error) throw new Error(ins.error.message)
  return ins.data
}

async function ensureHospital(tenant, name) {
  const { data: existing } = await db.from("hospitals").select("id,subdomain").eq("subdomain", tenant.slug).maybeSingle()
  if (existing) {
    await db.from("hospitals").update({
      is_synthetic: true,
      environment: "e2e",
      settings: { tenant_id: tenant.id },
    }).eq("id", existing.id)
    return existing
  }
  const ins = await db.from("hospitals").insert({
    name,
    subdomain: tenant.slug,
    type: "hospital",
    is_synthetic: true,
    environment: "e2e",
    settings: { tenant_id: tenant.id },
  }).select("id,subdomain").single()
  if (ins.error) throw new Error(ins.error.message)
  return ins.data
}

async function ensureProfile({ tenantId, role, email, fullName }) {
  const { data: existing } = await db.from("profiles").select("id,email,role").eq("email", email).maybeSingle()
  const now = new Date().toISOString()
  const row = {
    email,
    role,
    tenant_id: tenantId,
    full_name: fullName,
    first_name: "E2E",
    last_name: role,
    password_hash: passwordHash,
    verification_status: "verified",
    email_verified_at: now,
    must_change_password: false,
    login_attempts: 0,
    locked_until: null,
    is_deleted: false,
    updated_at: now,
  }
  if (existing) {
    const upd = await db.from("profiles").update(row).eq("id", existing.id)
    if (upd.error) throw new Error(upd.error.message)
    return existing
  }
  const ins = await db.from("profiles").insert({ id: randomUUID(), ...row }).select("id,email,role").single()
  if (ins.error) throw new Error(ins.error.message)
  return ins.data
}

async function ensureAmina(tenantId, hospitalId) {
  const { data: existingPerson } = await db.from("persons").select("id,synapse_id").eq("full_name", "Amina E2E").maybeSingle()
  let person = existingPerson
  if (!person) {
    const ins = await db.from("persons").insert({
      given_name: "Amina",
      family_name: "E2E",
      full_name: "Amina E2E",
      date_of_birth: "2002-03-15",
      sex: "F",
      country_code: "UG",
    }).select("id,synapse_id").single()
    if (ins.error) throw new Error(ins.error.message)
    person = ins.data
  }
  const { data: ident } = await db.from("person_identifiers").select("id").eq("person_id", person.id).eq("identifier_type", "SYNAPSE_ID").maybeSingle()
  if (!ident && person.synapse_id) {
    await db.from("person_identifiers").insert({
      person_id: person.id,
      identifier_value: person.synapse_id,
      identifier_type: "SYNAPSE_ID",
      issuing_facility_id: tenantId,
      source_system: "synapse-e2e",
      status: "active",
    })
  }
  const { data: patient } = await db.from("patients").select("id,mrn").eq("tenant_id", tenantId).eq("full_name", "Amina E2E").maybeSingle()
  if (!patient) {
    const ins = await db.from("patients").insert({
      tenant_id: tenantId,
      hospital_id: hospitalId,
      person_id: person.id,
      mrn: `E2E-${Date.now().toString(36).toUpperCase()}`,
      full_name: "Amina E2E",
      sex: "F",
      dob: "2002-03-15",
      is_synthetic: true,
      is_deleted: false,
    }).select("id,mrn").single()
    if (ins.error) throw new Error(ins.error.message)
    return { person, patient: ins.data }
  }
  return { person, patient }
}

const tenantA = await ensureTenant(FACILITY_A, "SYNAPSE E2E Hospital")
const tenantB = await ensureTenant(FACILITY_B, "SYNAPSE E2E Hospital B")
const hospitalA = await ensureHospital(tenantA, "SYNAPSE E2E Hospital")
const hospitalB = await ensureHospital(tenantB, "SYNAPSE E2E Hospital B")

const created = []
for (const role of ROLES_A) {
  created.push(await ensureProfile({
    tenantId: tenantA.id,
    role,
    email: emailFor(role, "a"),
    fullName: `E2E ${role}`,
  }))
}
created.push(await ensureProfile({
  tenantId: tenantB.id,
  role: "doctor",
  email: emailFor("doctor", "b"),
  fullName: "E2E doctor B",
}))

const amina = await ensureAmina(tenantA.id, hospitalA.id)

console.log(JSON.stringify({
  ok: true,
  facilityA: FACILITY_A,
  facilityB: FACILITY_B,
  tenantA: tenantA.id,
  tenantB: tenantB.id,
  hospitalA: hospitalA.id,
  hospitalB: hospitalB.id,
  emails: created.map((row) => row.email),
  personId: amina.person.id,
  synapseId: amina.person.synapse_id,
  patientId: amina.patient.id,
  passwordPrinted: false,
  fingerprint: createHash("sha256").update(password).digest("hex").slice(0, 12),
}, null, 2))
