#!/usr/bin/env tsx
/**
 * Idempotent synthetic OS E2E fixture.
 *
 * Requires:
 *   SYNAPSE_E2E_SEED=true
 *   SYNAPSE_E2E_PASSWORD=...
 *   SYNAPSE_E2E_SUPABASE_URL + SYNAPSE_E2E_SERVICE_ROLE_KEY
 *     or SYNAPSE_E2E_ALLOW_PRODUCTION_DB=true plus SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Never prints the password. Never hashes passwords with SHA-256.
 */
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import {
  ensureCapabilityLattice,
  ensureHospitalModules,
  ensureParacetamolCatalog,
  ensureServiceCatalog,
} from "./e2e-os-capability-lattice.ts"

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Keep in sync with packages/auth/src/e2e-otp.ts. Inlined so this script can run under Node+tsx without CJS named-export failures. */
const E2E_ROLE_EMAILS = {
  receptionist: "reception.e2e@synapseos.invalid",
  nurse: "nurse.e2e@synapseos.invalid",
  doctor: "doctor.e2e@synapseos.invalid",
  lab_tech: "labtech.e2e@synapseos.invalid",
  lab_scientist: "labscientist.e2e@synapseos.invalid",
  pharmacist: "pharmacist.e2e@synapseos.invalid",
  billing_officer: "cashier.e2e@synapseos.invalid",
  hospital_admin: "admin.e2e@synapseos.invalid",
  doctor_b: "doctor.b.e2e@synapseos.invalid",
} as const

function assertE2eSeedAllowed(input: { seedFlag?: string; slugA?: string; slugB?: string }): void {
  if (input.seedFlag !== "true") {
    throw new Error("Refusing to seed. Set SYNAPSE_E2E_SEED=true")
  }
  const allowed = new Set(["synapse-e2e-hospital", "synapse-e2e-hospital-b"])
  if (!allowed.has(String(input.slugA)) || !allowed.has(String(input.slugB)) || input.slugA === input.slugB) {
    throw new Error("Seed only permits synapse-e2e-hospital and synapse-e2e-hospital-b")
  }
}

const FACILITY_A = "synapse-e2e-hospital"
const FACILITY_B = "synapse-e2e-hospital-b"

const ROLE_USERS: Array<{ role: keyof typeof E2E_ROLE_EMAILS; tenant: "a" | "b"; fullName: string }> = [
  { role: "receptionist", tenant: "a", fullName: "E2E Reception" },
  { role: "nurse", tenant: "a", fullName: "E2E Nurse" },
  { role: "doctor", tenant: "a", fullName: "E2E Doctor" },
  { role: "lab_tech", tenant: "a", fullName: "E2E Lab Tech" },
  { role: "lab_scientist", tenant: "a", fullName: "E2E Lab Scientist" },
  { role: "pharmacist", tenant: "a", fullName: "E2E Pharmacist" },
  { role: "billing_officer", tenant: "a", fullName: "E2E Cashier" },
  { role: "hospital_admin", tenant: "a", fullName: "E2E Facility Admin" },
  { role: "doctor_b", tenant: "b", fullName: "E2E Doctor B" },
]

const ROLE_MAP: Record<keyof typeof E2E_ROLE_EMAILS, string> = {
  receptionist: "receptionist",
  nurse: "nurse",
  doctor: "doctor",
  lab_tech: "lab_technician",
  lab_scientist: "lab_scientist",
  pharmacist: "pharmacist",
  billing_officer: "billing_officer",
  hospital_admin: "hospital_admin",
  doctor_b: "doctor",
}

assertE2eSeedAllowed({
  seedFlag: process.env.SYNAPSE_E2E_SEED,
  slugA: FACILITY_A,
  slugB: FACILITY_B,
})

const password = process.env.SYNAPSE_E2E_PASSWORD?.trim()
if (!password || password.length < 12) {
  console.error("SYNAPSE_E2E_PASSWORD must be set (12+ characters). It will not be printed.")
  process.exit(1)
}

const isolatedUrl = (process.env.SYNAPSE_E2E_SUPABASE_URL || "").trim()
const isolatedKey = (process.env.SYNAPSE_E2E_SERVICE_ROLE_KEY || "").trim()
const allowProductionDb = process.env.SYNAPSE_E2E_ALLOW_PRODUCTION_DB === "true"
const productionUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
const productionKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

let url = isolatedUrl
let key = isolatedKey
if (!url || !key) {
  if (!allowProductionDb || !productionUrl || !productionKey) {
    console.error("Refusing to seed. Provide SYNAPSE_E2E_SUPABASE_URL and SYNAPSE_E2E_SERVICE_ROLE_KEY, or set SYNAPSE_E2E_ALLOW_PRODUCTION_DB=true with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }
  url = productionUrl
  key = productionKey
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const passwordHash = await hashPassword(password)
if (!(await verifyPassword(password, passwordHash))) {
  throw new Error("Seeded password does not verify through the production password path")
}
if (!/^\$2[aby]\$12\$/.test(passwordHash)) {
  throw new Error("Seeded password hash is not bcrypt cost 12")
}

async function ensureTenant(slug: string, name: string) {
  const { data: existing, error } = await db.from("tenants").select("id,slug").eq("slug", slug).maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) {
    const upd = await db.from("tenants").update({
      is_synthetic: true,
      environment: "demo",
      data_classification: "synthetic",
      status: "active",
      lifecycle_status: "ACTIVE",
      facility_type: "hospital",
    }).eq("id", existing.id)
    if (upd.error) throw new Error(upd.error.message)
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
    environment: "demo",
    data_classification: "synthetic",
    lifecycle_status: "ACTIVE",
    plan: "trial",
  }).select("id,slug").single()
  if (ins.error) throw new Error(ins.error.message)
  return ins.data
}

async function ensureHospital(tenant: { id: string; slug: string }, name: string) {
  const { data: existing } = await db.from("hospitals").select("id,subdomain").eq("subdomain", tenant.slug).maybeSingle()
  if (existing) {
    const upd = await db.from("hospitals").update({
      is_synthetic: true,
      environment: "demo",
      settings: { tenant_id: tenant.id },
    }).eq("id", existing.id)
    if (upd.error) throw new Error(upd.error.message)
    return existing
  }
  const ins = await db.from("hospitals").insert({
    name,
    subdomain: tenant.slug,
    type: "general",
    is_synthetic: true,
    environment: "demo",
    settings: { tenant_id: tenant.id },
  }).select("id,subdomain").single()
  if (ins.error) throw new Error(ins.error.message)
  return ins.data
}

async function ensureProfile(input: { tenantId: string; hospitalId: string; role: string; email: string; fullName: string }) {
  const { data: existing } = await db.from("profiles").select("id,email,role,tenant_id").eq("email", input.email).maybeSingle()
  if (existing && existing.tenant_id && existing.tenant_id !== input.tenantId) {
    throw new Error(`Refusing to reassign ${input.email} away from its existing tenant`)
  }
  const now = new Date().toISOString()
  const row = {
    email: input.email,
    role: input.role,
    tenant_id: input.tenantId,
    hospital_id: input.hospitalId,
    full_name: input.fullName,
    first_name: "E2E",
    last_name: input.role,
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

async function ensureAmina(tenantId: string, hospitalId: string) {
  const { data: existingPatient, error: patientErr } = await db
    .from("patients")
    .select("id,mrn,person_id")
    .eq("tenant_id", tenantId)
    .eq("full_name", "Amina E2E")
    .maybeSingle()
  if (patientErr) throw new Error(patientErr.message)

  let personId = existingPatient?.person_id as string | null | undefined
  if (!personId) {
    const { data: existingPerson } = await db.from("persons").select("id,synapse_id").eq("full_name", "Amina E2E").maybeSingle()
    if (existingPerson) {
      personId = existingPerson.id
    } else {
      const ins = await db.from("persons").insert({
        given_name: "Amina",
        family_name: "E2E",
        full_name: "Amina E2E",
        date_of_birth: "2002-03-15",
        sex: "F",
        country_code: "UG",
      }).select("id,synapse_id").single()
      if (ins.error) throw new Error(ins.error.message)
      personId = ins.data.id
    }
  }

  const { data: person } = await db.from("persons").select("id,synapse_id").eq("id", personId).single()
  if (!person) throw new Error("Amina E2E person row missing after ensure")

  const { data: ident } = await db.from("person_identifiers").select("id").eq("person_id", person.id).eq("identifier_type", "SYNAPSE_ID").maybeSingle()
  if (!ident && person.synapse_id) {
    const insIdent = await db.from("person_identifiers").insert({
      person_id: person.id,
      identifier_value: person.synapse_id,
      identifier_type: "SYNAPSE_ID",
      issuing_facility_id: tenantId,
      source_system: "synapse-e2e",
      status: "active",
    })
    if (insIdent.error) throw new Error(insIdent.error.message)
  }

  if (existingPatient) {
    return { person, patient: existingPatient }
  }

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

const tenantA = await ensureTenant(FACILITY_A, "SYNAPSE E2E Hospital")
const tenantB = await ensureTenant(FACILITY_B, "SYNAPSE E2E Hospital B")
const hospitalA = await ensureHospital(tenantA, "SYNAPSE E2E Hospital")
const hospitalB = await ensureHospital(tenantB, "SYNAPSE E2E Hospital B")

const created = []
for (const user of ROLE_USERS) {
  created.push(await ensureProfile({
    tenantId: user.tenant === "a" ? tenantA.id : tenantB.id,
    hospitalId: user.tenant === "a" ? hospitalA.id : hospitalB.id,
    role: ROLE_MAP[user.role],
    email: E2E_ROLE_EMAILS[user.role],
    fullName: user.fullName,
  }))
}

const amina = await ensureAmina(tenantA.id, hospitalA.id)
const lattice = await ensureCapabilityLattice(db)
const modulesA = await ensureHospitalModules(db, { tenantId: tenantA.id, hospitalId: hospitalA.id })
const modulesB = await ensureHospitalModules(db, { tenantId: tenantB.id, hospitalId: hospitalB.id })
const catalogA = await ensureServiceCatalog(db, tenantA.id)
const catalogB = await ensureServiceCatalog(db, tenantB.id)
const formulary = await ensureParacetamolCatalog(db, tenantA.id)

const { count: aminaCount, error: aminaCountErr } = await db
  .from("patients")
  .select("*", { count: "exact", head: true })
  .eq("tenant_id", tenantA.id)
  .eq("full_name", "Amina E2E")
if (aminaCountErr) throw new Error(aminaCountErr.message)
if ((aminaCount ?? 0) !== 1) {
  throw new Error(`Amina E2E must exist exactly once in ${FACILITY_A}; found ${aminaCount ?? 0}`)
}

const { count: emailCount, error: emailCountErr } = await db
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .in("email", created.map((row) => row.email))
if (emailCountErr) throw new Error(emailCountErr.message)
if ((emailCount ?? 0) !== created.length) {
  throw new Error("E2E role emails are not unique after seed")
}

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
  aminaCount,
  capabilities: lattice.capabilities,
  roleGrants: lattice.grants,
  modulesA,
  modulesB,
  serviceCatalogA: catalogA,
  serviceCatalogB: catalogB,
  paracetamolProductId: formulary.productId,
  paracetamolBatchId: formulary.batchId,
  passwordPrinted: false,
  passwordHashAlgorithm: "bcrypt",
  passwordHashCost: 12,
}, null, 2))
