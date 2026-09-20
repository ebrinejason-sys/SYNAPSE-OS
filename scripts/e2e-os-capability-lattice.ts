/**
 * Idempotent capability lattice + hospital-module + minimal formulary
 * prerequisites for isolated Core OS acceptance.
 *
 * Source: existing canonical migration DML (module registry, prescription v2,
 * laboratory alignment, encounter amendments) plus the documented OPD sign
 * grant from capability-map. Does not invent RLS policies.
 */
export type CapTriple = { module: string; resource: string; action: string; description?: string }
export type RoleGrant = { role: string; facilityType: string; module: string; resource: string; action: string }

export const E2E_HOSPITAL_MODULES = [
  "core",
  "registration",
  "opd",
  "clinical",
  "ipd",
  "lab",
  "dispensing",
  "billing",
  "emergency",
] as const

export const E2E_CAPABILITIES: CapTriple[] = [
  { module: "opd", resource: "queue", action: "read", description: "View OPD queue" },
  { module: "opd", resource: "queue", action: "write", description: "Manage OPD queue" },
  { module: "opd", resource: "triage", action: "assign", description: "Assign triage acuity" },
  { module: "opd", resource: "encounter", action: "create", description: "Create OPD encounter" },
  { module: "opd", resource: "encounter", action: "sign", description: "Sign OPD encounter" },
  { module: "opd", resource: "encounter", action: "amend", description: "Amend signed encounter note via trail" },
  { module: "opd", resource: "prescription", action: "create", description: "Create clinical prescription" },
  { module: "opd", resource: "prescription", action: "read", description: "View clinical prescriptions" },
  { module: "ipd", resource: "admission", action: "create", description: "Admit patient to ward" },
  { module: "ipd", resource: "admission", action: "read", description: "View admissions" },
  { module: "ward", resource: "bed", action: "read", description: "View bed board" },
  { module: "ward", resource: "bed", action: "assign", description: "Assign patient to bed" },
  { module: "ward", resource: "round", action: "write", description: "Document ward round" },
  { module: "lab", resource: "order", action: "create", description: "Create lab order" },
  { module: "lab", resource: "order", action: "read", description: "View lab orders" },
  { module: "lab", resource: "specimen", action: "collect", description: "Collect facility laboratory specimens" },
  { module: "lab", resource: "result", action: "enter", description: "Enter lab result" },
  { module: "lab", resource: "result", action: "verify", description: "Verify lab result" },
  { module: "lab", resource: "result", action: "read", description: "Read facility laboratory results" },
  { module: "billing", resource: "invoice", action: "create", description: "Create patient invoice" },
  { module: "billing", resource: "invoice", action: "read", description: "View invoices" },
  { module: "billing", resource: "payment", action: "record", description: "Record payment" },
  { module: "dispensing", resource: "order", action: "fulfill", description: "Fulfill hospital drug order" },
  { module: "dispensing", resource: "inventory", action: "read", description: "View hospital formulary stock" },
  { module: "dispensing", resource: "prescription", action: "verify", description: "Verify clinical prescription" },
  { module: "dispensing", resource: "prescription", action: "dispense", description: "Dispense clinical prescription" },
  { module: "registration", resource: "patient", action: "register", description: "Register new patient" },
  { module: "emergency", resource: "triage", action: "assign", description: "Assign emergency triage" },
  { module: "config", resource: "module", action: "read", description: "View module toggles" },
  { module: "config", resource: "module", action: "write", description: "Enable/disable modules" },
  { module: "config", resource: "service", action: "read", description: "View service catalog" },
  { module: "config", resource: "service", action: "write", description: "Manage service catalog" },
  { module: "config", resource: "audit", action: "read", description: "View audit log" },
  { module: "config", resource: "staff", action: "read", description: "View staff roster" },
  { module: "config", resource: "staff", action: "write", description: "Invite and manage staff" },
]

export const E2E_ROLE_GRANTS: RoleGrant[] = [
  { role: "receptionist", facilityType: "hospital", module: "registration", resource: "patient", action: "register" },
  { role: "receptionist", facilityType: "hospital", module: "opd", resource: "queue", action: "read" },
  { role: "receptionist", facilityType: "hospital", module: "opd", resource: "queue", action: "write" },
  { role: "receptionist", facilityType: "hospital", module: "opd", resource: "encounter", action: "create" },

  { role: "nurse", facilityType: "hospital", module: "ward", resource: "bed", action: "read" },
  { role: "nurse", facilityType: "hospital", module: "ward", resource: "bed", action: "assign" },
  { role: "nurse", facilityType: "hospital", module: "ward", resource: "round", action: "write" },
  { role: "nurse", facilityType: "hospital", module: "ipd", resource: "admission", action: "read" },
  { role: "nurse", facilityType: "hospital", module: "emergency", resource: "triage", action: "assign" },
  { role: "nurse", facilityType: "hospital", module: "opd", resource: "triage", action: "assign" },
  { role: "nurse", facilityType: "hospital", module: "opd", resource: "queue", action: "read" },

  { role: "doctor", facilityType: "hospital", module: "opd", resource: "encounter", action: "create" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "encounter", action: "sign" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "encounter", action: "amend" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "triage", action: "assign" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "queue", action: "read" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "prescription", action: "create" },
  { role: "doctor", facilityType: "hospital", module: "opd", resource: "prescription", action: "read" },
  { role: "doctor", facilityType: "hospital", module: "lab", resource: "order", action: "create" },
  { role: "doctor", facilityType: "hospital", module: "lab", resource: "order", action: "read" },
  { role: "doctor", facilityType: "hospital", module: "billing", resource: "invoice", action: "read" },
  { role: "clinical_officer", facilityType: "hospital", module: "opd", resource: "encounter", action: "create" },
  { role: "clinical_officer", facilityType: "hospital", module: "opd", resource: "encounter", action: "amend" },
  { role: "clinical_officer", facilityType: "hospital", module: "opd", resource: "prescription", action: "create" },
  { role: "clinical_officer", facilityType: "hospital", module: "opd", resource: "prescription", action: "read" },
  { role: "clinical_officer", facilityType: "hospital", module: "lab", resource: "order", action: "create" },

  { role: "lab_tech", facilityType: "hospital", module: "lab", resource: "order", action: "read" },
  { role: "lab_tech", facilityType: "hospital", module: "lab", resource: "order", action: "create" },
  { role: "lab_tech", facilityType: "hospital", module: "lab", resource: "result", action: "enter" },
  { role: "lab_tech", facilityType: "hospital", module: "lab", resource: "specimen", action: "collect" },
  { role: "lab_tech", facilityType: "hospital", module: "lab", resource: "result", action: "read" },
  { role: "lab_technician", facilityType: "hospital", module: "lab", resource: "order", action: "read" },
  { role: "lab_technician", facilityType: "hospital", module: "lab", resource: "order", action: "create" },
  { role: "lab_technician", facilityType: "hospital", module: "lab", resource: "specimen", action: "collect" },
  { role: "lab_technician", facilityType: "hospital", module: "lab", resource: "result", action: "read" },
  { role: "lab_technician", facilityType: "hospital", module: "lab", resource: "result", action: "enter" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "order", action: "read" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "order", action: "create" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "specimen", action: "collect" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "result", action: "read" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "result", action: "enter" },
  { role: "lab_scientist", facilityType: "hospital", module: "lab", resource: "result", action: "verify" },

  { role: "pharmacist", facilityType: "hospital", module: "dispensing", resource: "order", action: "fulfill" },
  { role: "pharmacist", facilityType: "hospital", module: "dispensing", resource: "inventory", action: "read" },
  { role: "pharmacist", facilityType: "hospital", module: "dispensing", resource: "prescription", action: "verify" },
  { role: "pharmacist", facilityType: "hospital", module: "dispensing", resource: "prescription", action: "dispense" },
  { role: "pharmacist", facilityType: "hospital", module: "opd", resource: "prescription", action: "read" },

  { role: "billing_officer", facilityType: "hospital", module: "billing", resource: "invoice", action: "create" },
  { role: "billing_officer", facilityType: "hospital", module: "billing", resource: "invoice", action: "read" },
  { role: "billing_officer", facilityType: "hospital", module: "billing", resource: "payment", action: "record" },
  { role: "cashier", facilityType: "hospital", module: "billing", resource: "invoice", action: "read" },

  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "module", action: "read" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "module", action: "write" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "service", action: "read" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "service", action: "write" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "audit", action: "read" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "staff", action: "read" },
  { role: "hospital_admin", facilityType: "hospital", module: "config", resource: "staff", action: "write" },
]

export async function ensureCapabilityLattice(db: { from: (table: string) => any }): Promise<{
  capabilities: number
  grants: number
}> {
  const capRows = E2E_CAPABILITIES.map((row) => ({
    module: row.module,
    resource: row.resource,
    action: row.action,
    description: row.description ?? null,
  }))
  const capUpsert = await db.from("capabilities").upsert(capRows, { onConflict: "module,resource,action" })
  if (capUpsert.error) throw new Error(`capabilities upsert failed: ${capUpsert.error.message}`)

  const { data: caps, error: capErr } = await db.from("capabilities").select("id, module, resource, action")
  if (capErr) throw new Error(capErr.message)
  const capId = new Map<string, string>()
  for (const row of caps ?? []) {
    capId.set(`${row.module}|${row.resource}|${row.action}`, row.id)
  }

  const grantRows = []
  for (const grant of E2E_ROLE_GRANTS) {
    const id = capId.get(`${grant.module}|${grant.resource}|${grant.action}`)
    if (!id) throw new Error(`missing capability ${grant.module}/${grant.resource}/${grant.action}`)
    grantRows.push({
      role: grant.role,
      facility_type: grant.facilityType,
      capability_id: id,
    })
  }
  const grantUpsert = await db.from("role_capabilities").upsert(grantRows, {
    onConflict: "role,facility_type,capability_id",
  })
  if (grantUpsert.error) throw new Error(`role_capabilities upsert failed: ${grantUpsert.error.message}`)

  return { capabilities: capRows.length, grants: grantRows.length }
}

export async function ensureHospitalModules(
  db: { from: (table: string) => any },
  input: { tenantId: string; hospitalId: string },
): Promise<number> {
  const now = new Date().toISOString()
  const rows = E2E_HOSPITAL_MODULES.map((module_key) => ({
    hospital_id: input.hospitalId,
    tenant_id: input.tenantId,
    module_key,
    is_active: true,
    activated_at: now,
  }))
  const { error } = await db.from("hospital_modules").upsert(rows, { onConflict: "hospital_id,module_key" })
  if (error) throw new Error(`hospital_modules upsert failed: ${error.message}`)
  return rows.length
}

export async function ensureServiceCatalog(
  db: { from: (table: string) => any },
  tenantId: string,
): Promise<number> {
  const items = [
    { name: "OPD Consultation", service_type: "consultation", price: 10000 },
    { name: "FBC", service_type: "lab", price: 15000 },
    { name: "Malaria RDT", service_type: "lab", price: 8000 },
  ]
  let upserted = 0
  for (const item of items) {
    const { data: existing, error: existingErr } = await db
      .from("service_catalog")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", item.name)
      .maybeSingle()
    if (existingErr) throw new Error(existingErr.message)
    if (existing?.id) {
      const { error } = await db
        .from("service_catalog")
        .update({ price: item.price, service_type: item.service_type, is_active: true, is_deleted: false })
        .eq("id", existing.id)
        .eq("tenant_id", tenantId)
      if (error) throw new Error(error.message)
      upserted += 1
      continue
    }
    const { error } = await db.from("service_catalog").insert({
      tenant_id: tenantId,
      name: item.name,
      service_type: item.service_type,
      price: item.price,
      currency: "UGX",
      is_active: true,
      is_deleted: false,
    })
    if (error) throw new Error(error.message)
    upserted += 1
  }
  return upserted
}

export const E2E_PARACETAMOL_SKU = "E2E-PARA-500"

export async function ensureParacetamolCatalog(
  db: { from: (table: string) => any },
  tenantId: string,
): Promise<{ productId: string; batchId: string; quantity: number }> {
  const { data: existing, error: existingErr } = await db
    .from("pharmacy_products")
    .select("id, quantity")
    .eq("tenant_id", tenantId)
    .eq("sku", E2E_PARACETAMOL_SKU)
    .maybeSingle()
  if (existingErr) throw new Error(existingErr.message)

  let productId = existing?.id as string | undefined
  if (!productId) {
    const ins = await db.from("pharmacy_products").insert({
      tenant_id: tenantId,
      sku: E2E_PARACETAMOL_SKU,
      name: "Paracetamol 500mg",
      generic_name: "Paracetamol",
      category: "analgesic",
      dosage_form: "tablet",
      strength: "500mg",
      unit_of_measure: "tablet",
      price: 200,
      cost_price: 80,
      quantity: 100,
      reorder_level: 10,
      is_active: true,
      requires_prescription: false,
    }).select("id, quantity").single()
    if (ins.error) throw new Error(ins.error.message)
    productId = ins.data.id
  }

  const { data: batch, error: batchErr } = await db
    .from("pharmacy_product_batches")
    .select("id, quantity")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .eq("batch_number", "E2E-PARA-FEFO-1")
    .maybeSingle()
  if (batchErr) throw new Error(batchErr.message)

  if (batch) {
    return { productId, batchId: batch.id, quantity: Number(batch.quantity ?? 0) }
  }

  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 1)
  const insBatch = await db.from("pharmacy_product_batches").insert({
    tenant_id: tenantId,
    product_id: productId,
    batch_number: "E2E-PARA-FEFO-1",
    quantity: 100,
    initial_quantity: 100,
    cost_price: 80,
    expiry_date: expiry.toISOString().slice(0, 10),
    is_active: true,
  }).select("id, quantity").single()
  if (insBatch.error) throw new Error(insBatch.error.message)
  return { productId, batchId: insBatch.data.id, quantity: Number(insBatch.data.quantity ?? 0) }
}
