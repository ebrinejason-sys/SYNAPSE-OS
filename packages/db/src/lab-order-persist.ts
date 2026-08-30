/**
 * Persist LabWorkflow orders to public.lab_orders (legacy status + workflow_status).
 */

import type { LabOrder } from "./lab-workflow.ts"
import { persistableLabOrderStatus } from "./lab-workflow.ts"

export type DbClient = {
  from(table: string): {
    upsert(row: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: { message?: string } | null }>
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>
  }
}

export function labOrderToRow(order: LabOrder): Record<string, unknown> {
  return {
    id: order.id,
    tenant_id: order.tenantId,
    encounter_id: order.encounterId,
    patient_id: order.patientId,
    person_id: order.personId ?? null,
    loinc_code: order.loincCode,
    test_name: order.testName,
    urgency: order.urgency,
    status: persistableLabOrderStatus(order.status),
    workflow_status: order.status,
    ordered_by: order.orderedBy,
    ordered_at: order.orderedAt,
    accession_number: order.accessionNumber ?? null,
    barcode: order.barcode ?? null,
    specimen_id: order.specimenId ?? null,
    rejection_reason: order.rejectionReason ?? null,
    rejection_note: order.rejectionNote ?? null,
    correlation_id: order.correlationId,
    care_plan_id: order.carePlanId ?? null,
    is_synthetic: order.isSynthetic,
    simulation_run_id: order.simulationRunId ?? null,
    data_classification: order.isSynthetic ? "synthetic" : "production",
  }
}

export function rowToLabOrder(row: Record<string, unknown>): LabOrder {
  const workflowStatus = (row.workflow_status as LabOrder["status"] | null) ?? "ORDERED"
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    personId: (row.person_id as string | null) ?? null,
    encounterId: String(row.encounter_id),
    carePlanId: (row.care_plan_id as string | null) ?? null,
    loincCode: String(row.loinc_code ?? ""),
    testName: String(row.test_name),
    urgency: row.urgency as LabOrder["urgency"],
    status: workflowStatus,
    orderedBy: String(row.ordered_by),
    orderedAt: String(row.ordered_at),
    accessionNumber: (row.accession_number as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    specimenId: (row.specimen_id as string | null) ?? null,
    rejectionReason: (row.rejection_reason as LabOrder["rejectionReason"]) ?? null,
    rejectionNote: (row.rejection_note as string | null) ?? null,
    isSynthetic: Boolean(row.is_synthetic),
    simulationRunId: (row.simulation_run_id as string | null) ?? null,
    correlationId: String(row.correlation_id ?? row.encounter_id),
  }
}

export async function persistLabOrderBestEffort(
  db: DbClient,
  order: LabOrder,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("lab_orders").upsert(labOrderToRow(order), { onConflict: "id" })
    if (error) return { ok: false, error: error.message ?? "lab_orders upsert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "lab_orders upsert threw" }
  }
}
