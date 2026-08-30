/**
 * Persist ClinicalPrescription rows to public.clinical_prescriptions.
 */

import type { ClinicalPrescription } from "./prescription-bridge.ts"

export type DbClient = {
  from(table: string): {
    upsert(row: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: { message?: string } | null }>
  }
}

export function clinicalPrescriptionToRow(rx: ClinicalPrescription): Record<string, unknown> {
  return {
    id: rx.id,
    tenant_id: rx.tenantId,
    pharmacy_tenant_id: rx.pharmacyTenantId ?? null,
    patient_id: rx.patientId,
    person_id: rx.personId ?? null,
    encounter_id: rx.encounterId,
    care_plan_id: rx.carePlanId ?? null,
    medication_display: rx.medicationDisplay,
    dose: rx.dose,
    quantity: rx.quantity,
    unit: rx.unit,
    prescriber_id: rx.prescriberId,
    verifier_id: rx.verifierId ?? null,
    dispenser_id: rx.dispenserId ?? null,
    status: rx.status,
    correlation_id: rx.correlationId,
    is_synthetic: rx.isSynthetic,
    simulation_run_id: rx.simulationRunId ?? null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToClinicalPrescription(row: Record<string, unknown>): ClinicalPrescription {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    pharmacyTenantId: (row.pharmacy_tenant_id as string | null) ?? null,
    patientId: String(row.patient_id),
    personId: (row.person_id as string | null) ?? null,
    encounterId: String(row.encounter_id),
    carePlanId: (row.care_plan_id as string | null) ?? null,
    medicationDisplay: String(row.medication_display),
    dose: String(row.dose ?? ""),
    quantity: Number(row.quantity ?? 1),
    unit: String(row.unit ?? "unit"),
    prescriberId: String(row.prescriber_id),
    verifierId: (row.verifier_id as string | null) ?? null,
    dispenserId: (row.dispenser_id as string | null) ?? null,
    status: row.status as ClinicalPrescription["status"],
    isSynthetic: Boolean(row.is_synthetic),
    simulationRunId: (row.simulation_run_id as string | null) ?? null,
    correlationId: String(row.correlation_id ?? row.id),
  }
}

export async function persistClinicalPrescriptionBestEffort(
  db: DbClient,
  rx: ClinicalPrescription,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("clinical_prescriptions").upsert(clinicalPrescriptionToRow(rx), {
      onConflict: "id",
    })
    if (error) return { ok: false, error: error.message ?? "clinical_prescriptions upsert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "clinical_prescriptions upsert threw" }
  }
}
