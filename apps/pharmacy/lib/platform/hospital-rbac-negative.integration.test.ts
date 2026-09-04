import { describe, expect, it } from "vitest"
import { supabaseAdmin } from "@synapse/db/admin"
import { hasDb } from "./test-db-guard"

if (!hasDb) {
  console.info("[integration] P0-RBAC SQL capability tests skipped: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run them")
}

type NegativeCase = {
  id: string
  role: string
  module: string
  resource: string
  action: string
}

const NEGATIVE_CASES: NegativeCase[] = [
  { id: "P0-RBAC-RECEPTIONIST-NO-LAB-VERIFY", role: "receptionist", module: "lab", resource: "result", action: "verify" },
  { id: "P0-RBAC-LAB-TECH-NO-PRESCRIBE", role: "lab_tech", module: "opd", resource: "prescription", action: "create" },
  { id: "P0-RBAC-CASHIER-NO-DIAGNOSIS-EDIT", role: "billing_officer", module: "opd", resource: "encounter", action: "amend" },
  { id: "P0-RBAC-PHARMACIST-NO-PHYSICIAN-DIAGNOSIS-AMEND", role: "pharmacist", module: "opd", resource: "encounter", action: "amend" },
  { id: "P0-RBAC-PLATFORM-ADMIN-NO-HOSPITAL-NOTES", role: "platform_admin", module: "clinical", resource: "note", action: "read" },
]

describe.skipIf(!hasDb)("hospital negative RBAC (P0-RBAC)", () => {
  it.each(NEGATIVE_CASES)("$id denies $role $module.$resource.$action", async ({ role, module, resource, action }) => {
    const db = supabaseAdmin as any
    const { data, error } = await db.rpc("has_capability", {
      p_role: role,
      p_facility_type: "hospital",
      p_module: module,
      p_resource: resource,
      p_action: action,
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})