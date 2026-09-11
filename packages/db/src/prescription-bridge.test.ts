import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertDispensePermission,
  assertPrescribePermission,
  canDispense,
  canPrescribe,
  createPrescription,
  dispensePrescription,
  verifyPrescription,
  type ClinicalPrescription,
} from "./prescription-bridge.ts"

function baseRx(overrides: Partial<ClinicalPrescription> = {}): ClinicalPrescription {
  return {
    id: "rx-1",
    tenantId: "tenant-a",
    patientId: "patient-1",
    encounterId: "enc-1",
    medicationDisplay: "Paracetamol 500mg",
    dose: "1 tab TID",
    quantity: 10,
    unit: "tablet",
    prescriberId: "doctor-1",
    status: "active",
    isSynthetic: true,
    correlationId: "enc-1",
    ...overrides,
  }
}

describe("prescription-bridge permissions", () => {
  it("allows doctors to prescribe and pharmacists to dispense", () => {
    assert.equal(canPrescribe("doctor"), true)
    assert.equal(canPrescribe("nurse"), false)
    assert.equal(canDispense("pharmacist"), true)
    assert.equal(canDispense("doctor"), false)
    assert.doesNotThrow(() => assertPrescribePermission("clinical_officer"))
    assert.throws(() => assertDispensePermission("doctor"), /DISPENSE_PERMISSION_DENIED/)
  })
})

describe("prescription-bridge lifecycle", () => {
  it("creates active prescriptions and rejects invalid quantity", () => {
    const rx = createPrescription(baseRx())
    assert.equal(rx.status, "active")
    assert.throws(() => createPrescription(baseRx({ quantity: 0 })), /QUANTITY_REQUIRED/)
    assert.throws(() => createPrescription(baseRx({ medicationDisplay: "  " })), /MEDICATION_REQUIRED/)
  })

  it("requires verification before dispense and blocks self-dispense", () => {
    const active = createPrescription(baseRx())
    assert.throws(
      () => dispensePrescription({ rx: active, dispenserId: "pharm-1", role: "pharmacist", availableStock: 20 }),
      /DISPENSE_REQUIRES_VERIFICATION/,
    )
    assert.throws(
      () => verifyPrescription(active, active.prescriberId, "pharmacist"),
      /PRESCRIBER_CANNOT_SELF_DISPENSE/,
    )
    const verified = verifyPrescription(active, "pharm-1", "pharmacist")
    assert.equal(verified.status, "verified")
    assert.equal(verified.verifierId, "pharm-1")
  })

  it("decrements stock exactly once and rejects insufficient stock", () => {
    const verified = verifyPrescription(createPrescription(baseRx({ quantity: 4 })), "pharm-1", "pharmacist")
    const first = dispensePrescription({
      rx: verified,
      dispenserId: "pharm-1",
      role: "pharmacist",
      availableStock: 10,
    })
    assert.equal(first.rx.status, "dispensed")
    assert.equal(first.remainingStock, 6)
    assert.throws(
      () =>
        dispensePrescription({
          rx: verified,
          dispenserId: "pharm-1",
          role: "pharmacist",
          availableStock: 2,
        }),
      /INSUFFICIENT_STOCK/,
    )
  })
})
