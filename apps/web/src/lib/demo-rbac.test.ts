import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { canPerformAction } from "./demo/entities.ts"

describe("demo domain RBAC", () => {
  it("blocks reception from prescribing", () => {
    assert.equal(canPerformAction("reception", "canPrescribe"), false)
  })
  it("blocks nurse from signing a doctor note", () => {
    assert.equal(canPerformAction("nurse", "canSignClinicalNote"), false)
  })
  it("blocks doctor from dispensing", () => {
    assert.equal(canPerformAction("doctor", "canDispense"), false)
  })
  it("blocks lab technician from releasing results", () => {
    assert.equal(canPerformAction("lab_technician", "canReleaseLabResult"), false)
  })
  it("blocks pharmacist from editing a doctor note", () => {
    assert.equal(canPerformAction("pharmacist", "canWriteClinicalNote"), false)
    assert.equal(canPerformAction("pharmacist", "canSignClinicalNote"), false)
  })
  it("blocks cashier from changing diagnosis", () => {
    assert.equal(canPerformAction("cashier", "canWriteClinicalNote"), false)
  })
})
