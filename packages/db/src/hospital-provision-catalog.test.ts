import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  defaultModulesForLevel,
  normalizeModuleKeys,
  slugify,
  LEGACY_MODULE_KEY_MAP,
  FACILITY_OWNERSHIP,
  FACILITY_LEVELS,
} from "./hospital-provision-catalog.ts"

describe("hospital-provision-catalog", () => {
  it("maps legacy module keys to canonical registry keys", () => {
    const keys = normalizeModuleKeys(["doctor", "laboratory", "pharmacy", "outpatient", "unknown_junk"])
    assert.ok(keys.includes("clinical"))
    assert.ok(keys.includes("lab"))
    assert.ok(keys.includes("dispensing"))
    assert.ok(keys.includes("opd"))
    assert.ok(keys.includes("core"))
    assert.equal(keys.includes("unknown_junk"), false)
    assert.equal(LEGACY_MODULE_KEY_MAP.doctor, "clinical")
  })

  it("defaults regional referral modules include clinical spine", () => {
    const keys = defaultModulesForLevel("REGIONAL_REFERRAL_HOSPITAL")
    for (const required of ["core", "opd", "clinical", "lab", "dispensing", "billing", "emergency"]) {
      assert.ok(keys.includes(required), required)
    }
  })

  it("slugifies facility names stably", () => {
    assert.equal(slugify("SYNAPSE Integrated Regional Hospital"), "synapse-integrated-regional-hospital")
    assert.equal(slugify("  Foo!! Bar  "), "foo-bar")
  })

  it("exposes ownership and facility level enums without overload", () => {
    assert.ok(FACILITY_OWNERSHIP.includes("PUBLIC"))
    assert.ok(FACILITY_OWNERSHIP.includes("MISSION_FAITH_BASED"))
    assert.ok(FACILITY_LEVELS.includes("REGIONAL_REFERRAL_HOSPITAL"))
    assert.ok(FACILITY_LEVELS.includes("CLINIC"))
    assert.equal(FACILITY_OWNERSHIP.includes("REGIONAL_REFERRAL_HOSPITAL" as never), false)
  })

  it("clinic defaults stay leaner than regional referral", () => {
    const clinic = defaultModulesForLevel("CLINIC")
    const regional = defaultModulesForLevel("REGIONAL_REFERRAL_HOSPITAL")
    assert.ok(clinic.length <= regional.length)
    assert.ok(!clinic.includes("theatre") || regional.includes("theatre"))
  })
})
