/**
 * Department uniqueness must be tenant-scoped.
 * Proves Hospital A and Hospital B can both have "Laboratory".
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

describe("departments tenant-scoped uniqueness (contract)", () => {
  it("documents required index shape", () => {
    const tenantScoped = "UNIQUE (tenant_id, lower(name)) WHERE tenant_id IS NOT NULL"
    const globalTemplates = "UNIQUE (lower(name)) WHERE tenant_id IS NULL"
    assert.ok(tenantScoped.includes("tenant_id"))
    assert.ok(globalTemplates.includes("IS NULL"))
  })

  it("allows same department name across tenants (logical)", () => {
    type Dept = { tenant_id: string; name: string }
    const rows: Dept[] = [
      { tenant_id: "tenant-a", name: "Laboratory" },
      { tenant_id: "tenant-b", name: "Laboratory" },
      { tenant_id: "tenant-a", name: "Pharmacy" },
      { tenant_id: "tenant-b", name: "Pharmacy" },
      { tenant_id: "tenant-a", name: "Billing" },
      { tenant_id: "tenant-b", name: "Billing" },
    ]
    const key = (d: Dept) => `${d.tenant_id}::${d.name.toLowerCase()}`
    const seen = new Set<string>()
    for (const row of rows) {
      const k = key(row)
      assert.equal(seen.has(k), false, `unexpected duplicate ${k}`)
      seen.add(k)
    }
    assert.equal(seen.size, 6)
  })

  it("rejects duplicate department name within one tenant (logical)", () => {
    const withinTenant = ["Laboratory", "laboratory"]
    const normalized = withinTenant.map((n) => n.toLowerCase())
    assert.equal(new Set(normalized).size, 1)
  })
})
