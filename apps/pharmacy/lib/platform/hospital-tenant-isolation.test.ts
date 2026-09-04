import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { supabaseAdmin } from "@synapse/db/admin"
import { appendClinicalCharge } from "@synapse/db/clinical-charge"
import { hasDb } from "./test-db-guard"

if (!hasDb) {
  console.info("[integration] P0-004 Supabase isolation tests skipped: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run them")
}

describe.skipIf(!hasDb)("hospital tenant isolation (P0-004)", () => {
  let tenantA: string
  let tenantB: string
  let patientA: string
  let encounterA: string
  let staffA: string
  let labOrderA: string
  let taskA: string
  let invoiceA: string

  beforeAll(async () => {
    tenantA = crypto.randomUUID()
    tenantB = crypto.randomUUID()
    patientA = crypto.randomUUID()
    encounterA = crypto.randomUUID()
    staffA = crypto.randomUUID()
    labOrderA = crypto.randomUUID()
    taskA = crypto.randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any

    for (const [id, name] of [[tenantA, "Tenant A"], [tenantB, "Tenant B"]] as const) {
      const { error } = await db.from("tenants").insert({
        id,
        name,
        facility_type: "hospital",
        is_synthetic: true,
        environment: "demo",
        data_classification: "synthetic",
      })
      if (error) throw new Error(error.message)
    }

    const { error: patientError } = await db.from("patients").insert({
      id: patientA,
      tenant_id: tenantA,
      mrn: `ISO-A-${Date.now()}`,
      first_name: "Tenant",
      last_name: "A Patient",
      date_of_birth: "1985-06-01",
      sex: "M",
    })
    if (patientError) throw new Error(patientError.message)

    const { error: encounterError } = await db.from("encounters").insert({
      id: encounterA,
      tenant_id: tenantA,
      patient_id: patientA,
      chief_complaint: "Cross-tenant probe",
      status: "open",
      visit_date: new Date().toISOString(),
      is_deleted: false,
      is_synthetic: true,
    })
    if (encounterError) throw new Error(encounterError.message)

    const { error: profileError } = await db.from("profiles").insert({
      id: staffA,
      email: `${staffA}@p0-004.invalid`,
      full_name: "Tenant A Staff",
      first_name: "Tenant A",
      last_name: "Staff",
      role: "doctor",
      tenant_id: tenantA,
      is_active: true,
      verification_status: "verified",
    })
    if (profileError) throw new Error(profileError.message)

    const { error: scopeError } = await db.from("staff_scope_assignments").insert({
      profile_id: staffA,
      tenant_id: tenantA,
      role: "doctor",
      is_active: true,
    })
    if (scopeError) throw new Error(scopeError.message)

    const { error: orderError } = await db.from("lab_orders").insert({
      id: labOrderA,
      tenant_id: tenantA,
      encounter_id: encounterA,
      patient_id: patientA,
      test_name: "P0-004 isolation test",
      ordered_by: staffA,
      is_synthetic: true,
    })
    if (orderError) throw new Error(orderError.message)

    const { error: taskError } = await db.from("department_tasks").insert({
      id: taskA,
      tenant_id: tenantA,
      patient_id: patientA,
      encounter_id: encounterA,
      owner_department: "OPD",
      task_type: "P0-004",
      title: "P0-004 isolation test",
      is_synthetic: true,
    })
    if (taskError) throw new Error(taskError.message)

    const charge = await appendClinicalCharge(db, {
      tenantId: tenantA,
      patientId: patientA,
      encounterId: encounterA,
      itemName: "P0-004 isolation test",
      unitPrice: 1,
      qty: 1,
      sourceTable: "encounters",
      sourceId: encounterA,
      createdBy: staffA,
    })
    invoiceA = charge.invoiceId
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    await db.from("billing_payments").delete().eq("tenant_id", tenantA)
    await db.from("billing_line_items").delete().eq("tenant_id", tenantA)
    await db.from("billing_invoices").delete().eq("tenant_id", tenantA)
    await db.from("department_tasks").delete().eq("id", taskA)
    await db.from("lab_orders").delete().eq("id", labOrderA)
    await db.from("encounters").delete().eq("tenant_id", tenantA)
    await db.from("patients").delete().eq("tenant_id", tenantA)
    await db.from("staff_scope_assignments").delete().eq("profile_id", staffA)
    await db.from("profiles").delete().eq("id", staffA)
    await db.from("tenants").delete().in("id", [tenantA, tenantB])
  })

  it("P0-004: tenant B cannot read tenant A encounters", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from("encounters")
      .select("id")
      .eq("id", encounterA)
      .eq("tenant_id", tenantB)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("P0-004: tenant B cannot read tenant A patients", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from("patients")
      .select("id")
      .eq("id", patientA)
      .eq("tenant_id", tenantB)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("P0-004: staff scope is bound to tenant A and cannot authorize tenant B", async () => {
    const db = supabaseAdmin as any
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("tenant_id")
      .eq("id", staffA)
      .single()
    const { data: scopes, error: scopeError } = await db
      .from("staff_scope_assignments")
      .select("tenant_id")
      .eq("profile_id", staffA)
      .eq("is_active", true)

    expect(profileError).toBeNull()
    expect(scopeError).toBeNull()
    expect(profile.tenant_id).toBe(tenantA)
    expect(scopes).toEqual([{ tenant_id: tenantA }])
    expect(scopes.some((scope: { tenant_id: string }) => scope.tenant_id === tenantB)).toBe(false)
  })

  it.each([
    ["lab_orders", labOrderA],
    ["department_tasks", taskA],
    ["billing_invoices", invoiceA],
  ])("P0-004: tenant B cannot read tenant A %s", async (table, id) => {
    const db = supabaseAdmin as any
    const { data, error } = await db
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantB)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
