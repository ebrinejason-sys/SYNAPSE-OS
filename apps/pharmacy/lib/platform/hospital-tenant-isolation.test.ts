import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { supabaseAdmin } from "@synapse/db/admin"
import { hasDb } from "./test-db-guard"

describe.skipIf(!hasDb)("hospital tenant isolation (P0-004)", () => {
  let tenantA: string
  let tenantB: string
  let patientA: string
  let encounterA: string

  beforeAll(async () => {
    tenantA = crypto.randomUUID()
    tenantB = crypto.randomUUID()
    patientA = crypto.randomUUID()
    encounterA = crypto.randomUUID()

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
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    await db.from("encounters").delete().eq("tenant_id", tenantA)
    await db.from("patients").delete().eq("tenant_id", tenantA)
    await db.from("tenants").delete().in("id", [tenantA, tenantB])
  })

  it("does not return tenant A encounter when filtered by tenant B", async () => {
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

  it("does not return tenant A patient when filtered by tenant B", async () => {
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
})
