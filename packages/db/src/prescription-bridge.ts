/**
 * Clinical prescription → Synapse Pharm intake contract.
 * Prescribing and dispensing remain separate permissions.
 */

export type ClinicalPrescriptionStatus = "active" | "verified" | "dispensed" | "cancelled" | "returned"

export type ClinicalPrescription = {
  id: string
  tenantId: string
  pharmacyTenantId?: string | null
  patientId: string
  personId?: string | null
  encounterId: string
  carePlanId?: string | null
  medicationDisplay: string
  dose: string
  quantity: number
  unit: string
  prescriberId: string
  verifierId?: string | null
  dispenserId?: string | null
  status: ClinicalPrescriptionStatus
  isSynthetic: boolean
  simulationRunId?: string | null
  correlationId: string
}

export type PharmacyIntake = {
  id: string
  prescriptionId: string
  tenantId: string
  status: "queued" | "verified" | "dispensed" | "rejected"
  notes?: string | null
}

const PRESCRIBE_ROLES = new Set(["doctor", "clinical_officer", "platform_admin"])
const DISPENSE_ROLES = new Set(["pharmacist", "pharmacy_admin", "pharmacy_store_manager", "platform_admin"])

export function canPrescribe(role: string): boolean {
  return PRESCRIBE_ROLES.has(role)
}

export function canDispense(role: string): boolean {
  return DISPENSE_ROLES.has(role)
}

export function assertPrescribePermission(role: string): void {
  if (!canPrescribe(role)) throw new Error("PRESCRIPTION_PERMISSION_DENIED")
}

export function assertDispensePermission(role: string): void {
  if (!canDispense(role)) throw new Error("DISPENSE_PERMISSION_DENIED")
}

export function createPrescription(input: ClinicalPrescription): ClinicalPrescription {
  if (!input.medicationDisplay.trim()) throw new Error("MEDICATION_REQUIRED")
  if (input.quantity <= 0) throw new Error("QUANTITY_REQUIRED")
  return { ...input, status: "active" }
}

export function verifyPrescription(rx: ClinicalPrescription, verifierId: string, role: string): ClinicalPrescription {
  assertDispensePermission(role)
  if (rx.status !== "active") throw new Error("PRESCRIPTION_NOT_VERIFIABLE")
  if (verifierId === rx.prescriberId && role !== "platform_admin") {
    throw new Error("PRESCRIBER_CANNOT_SELF_DISPENSE")
  }
  return { ...rx, status: "verified", verifierId }
}

export function dispensePrescription(params: {
  rx: ClinicalPrescription
  dispenserId: string
  role: string
  availableStock: number
}): { rx: ClinicalPrescription; remainingStock: number } {
  assertDispensePermission(params.role)
  if (params.rx.status !== "verified") throw new Error("DISPENSE_REQUIRES_VERIFICATION")
  if (params.availableStock < params.rx.quantity) throw new Error("INSUFFICIENT_STOCK")
  return {
    rx: { ...params.rx, status: "dispensed", dispenserId: params.dispenserId },
    remainingStock: params.availableStock - params.rx.quantity,
  }
}

export function toPharmacyOrderNotes(rx: ClinicalPrescription): string {
  return [
    `Clinical prescription ${rx.id}`,
    rx.medicationDisplay,
    `qty ${rx.quantity} ${rx.unit}`,
    rx.isSynthetic ? "SYNTHETIC" : "CLINICAL",
  ].join(" · ")
}
