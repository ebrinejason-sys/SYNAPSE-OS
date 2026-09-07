import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CLINIC_DEFAULT_MODULES,
  FACILITY_TYPES,
  defaultModulesForFacilityType,
  facilityInviteUrl,
  pharmacyLoginUrl,
  pharmacyTenantSlug,
} from "./facility-provision-catalog.ts"

describe("facility-provision-catalog", () => {
  it("supports all first-class facility types", () => {
    assert.deepEqual([...FACILITY_TYPES], [
      "hospital",
      "clinic",
      "health_centre",
      "pharmacy",
      "laboratory",
    ])
  })

  it("clinic defaults exclude inpatient/theatre/maternity", () => {
    const mods = defaultModulesForFacilityType("clinic")
    assert.ok(mods.includes("core"))
    assert.ok(mods.includes("opd"))
    assert.ok(!mods.includes("ipd"))
    assert.ok(!mods.includes("theatre"))
    assert.ok(!mods.includes("maternity"))
    assert.deepEqual(mods, [...CLINIC_DEFAULT_MODULES])
  })

  it("pharmacy defaults are pharmacy capabilities not hospital-only", () => {
    const mods = defaultModulesForFacilityType("pharmacy")
    assert.ok(mods.includes("pos"))
    assert.ok(mods.includes("inventory"))
    assert.ok(mods.includes("pharmacy_network"))
    assert.ok(!mods.includes("opd"))
    assert.ok(!mods.includes("ipd"))
  })

  it("laboratory defaults exclude OPD/IPD/maternity/theatre", () => {
    const mods = defaultModulesForFacilityType("laboratory")
    assert.ok(mods.includes("lab"))
    assert.ok(mods.includes("registration"))
    assert.ok(!mods.includes("opd"))
    assert.ok(!mods.includes("ipd"))
    assert.ok(!mods.includes("maternity"))
    assert.ok(!mods.includes("theatre"))
  })

  it("pharmacy slug and login URL use pharm.synapseos.tech?tenant=", () => {
    assert.equal(pharmacyTenantSlug("Acme Chemist"), "pharm-acme-chemist")
    assert.equal(
      pharmacyLoginUrl("pharm-acme-chemist"),
      "https://pharm.synapseos.tech/login?tenant=acme-chemist",
    )
  })

  it("keeps hospital and laboratory invitations on their tenant host", () => {
    assert.equal(
      facilityInviteUrl("hospital", "mulago", "invite-token", { appUrl: "https://synapseos.tech" }),
      "https://mulago.synapseos.tech/invite/facility/invite-token",
    )
    assert.equal(
      facilityInviteUrl("laboratory", "pilot-lab", "invite-token", { appUrl: "https://admin.synapseos.tech" }),
      "https://pilot-lab.synapseos.tech/invite/facility/invite-token",
    )
  })

  it("routes pharmacy facility invitations to the pharmacy application", () => {
    assert.equal(
      facilityInviteUrl("pharmacy", "pharm-acme", "invite/token"),
      "https://pharm.synapseos.tech/invite/facility/invite%2Ftoken",
    )
  })
})
