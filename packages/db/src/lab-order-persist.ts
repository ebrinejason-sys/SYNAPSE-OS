/**
 * Persist LabWorkflow orders to public.lab_orders (legacy status + workflow_status).
 */

import { InvalidIdentifierError, optionalUuid, requireUuid } from "./identifiers.ts"
import type { LabOrder } from "./lab-workflow"
import { persistableLabOrderStatus } from "./lab-workflow"

export type DbClient = {
  from(table: string): {
    upsert(row: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: { message?: string } | null }>
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>
  }
}

export function labOrderToRow(order: LabOrder): Record<string, unknown> {
  return {
    id: requireUuid(order.id, "id"),
    tenant_id: requireUuid(order.tenantId, "tenant_id"),
    encounter_id: requireUuid(order.encounterId, "encounter_id"),
    patient_id: requireUuid(order.patientId, "patient_id"),
    person_id: optionalUuid(order.personId, "person_id"),
    loinc_code: order.loincCode,
    test_name: order.testName,
    urgency: order.urgency,
    status: persistableLabOrderStatus(order.status),
    workflow_status: order.status,
    ordered_by: requireUuid(order.orderedBy, "ordered_by"),
    ordered_at: order.orderedAt,
    accession_number: order.accessionNumber ?? null,
    barcode: order.barcode ?? null,
    specimen_id: optionalUuid(order.specimenId, "specimen_id"),
    rejection_reason: order.rejectionReason ?? null,
    rejection_note: order.rejectionNote ?? null,
    correlation_id: requireUuid(order.correlationId, "correlation_id"),
    care_plan_id: optionalUuid(order.carePlanId, "care_plan_id"),
    is_synthetic: order.isSynthetic,
    simulation_run_id: optionalUuid(order.simulationRunId, "simulation_run_id"),
    data_classification: order.isSynthetic ? "synthetic" : "clinical",
    replaces_lab_order_id: optionalUuid(order.replacesLabOrderId, "replaces_lab_order_id"),
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
    replacesLabOrderId: (row.replaces_lab_order_id as string | null) ?? null,
  }
}

export async function persistLabOrderBestEffort(
  db: DbClient,
  order: LabOrder,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const row = labOrderToRow(order)
    const { error } = await db.from("lab_orders").upsert(row, { onConflict: "id" })
    if (error) return { ok: false, error: error.message ?? "lab_orders upsert failed" }
    return { ok: true }
  } catch (err) {
    if (err instanceof InvalidIdentifierError) return { ok: false, error: err.message }
    return { ok: false, error: err instanceof Error ? err.message : "lab_orders upsert threw" }
  }
}
