import { describe, expect, it } from "vitest"
import {
  createPrescription,
  dispensePrescription,
  verifyPrescription,
  type ClinicalPrescription,
} from "@synapse/db/prescription-bridge"

function baseRx(overrides: Partial<ClinicalPrescription> = {}): ClinicalPrescription {
  return {
    id: "rx-1",
    tenantId: "tenant-1",
    patientId: "patient-1",
    encounterId: "enc-1",
    medicationDisplay: "Paracetamol 500mg",
    dose: "1g TDS",
    quantity: 2,
    unit: "tablets",
    prescriberId: "doctor-1",
    status: "active",
    isSynthetic: true,
    correlationId: "enc-1",
    ...overrides,
  }
}

describe("prescription-bridge dispense safety (P0-001)", () => {
  it("requires verification before dispense", () => {
    const rx = createPrescription(baseRx())
    expect(() =>
      dispensePrescription({
        rx,
        dispenserId: "pharmacist-1",
        role: "pharmacist",
        availableStock: 10,
      }),
    ).toThrow("DISPENSE_REQUIRES_VERIFICATION")
  })

  it("rejects dispense when stock is insufficient", () => {
    const verified = verifyPrescription(baseRx(), "pharmacist-1", "pharmacist")
    expect(() =>
      dispensePrescription({
        rx: verified,
        dispenserId: "pharmacist-1",
        role: "pharmacist",
        availableStock: 1,
      }),
    ).toThrow("INSUFFICIENT_STOCK")
  })

  it("marks dispensed and computes remaining stock once", () => {
    const verified = verifyPrescription(baseRx(), "pharmacist-1", "pharmacist")
    const first = dispensePrescription({
      rx: verified,
      dispenserId: "pharmacist-1",
      role: "pharmacist",
      availableStock: 10,
    })
    expect(first.rx.status).toBe("dispensed")
    expect(first.remainingStock).toBe(8)

    expect(() =>
      dispensePrescription({
        rx: first.rx,
        dispenserId: "pharmacist-1",
        role: "pharmacist",
        availableStock: first.remainingStock,
      }),
    ).toThrow("DISPENSE_REQUIRES_VERIFICATION")
  })

  it("blocks prescriber self-verification unless platform admin", () => {
    const rx = createPrescription(baseRx())
    expect(() => verifyPrescription(rx, "doctor-1", "pharmacist")).toThrow(
      "PRESCRIBER_CANNOT_SELF_DISPENSE",
    )
  })
})
