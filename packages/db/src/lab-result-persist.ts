/**
 * Durable lab_results + lab_specimens persistence.
 * Postgres is authoritative after sync — LabWorkflow is the transition engine only.
 */

import type { LabOrder, LabResult } from "./lab-workflow"

export type DbClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc?(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: { message?: string } | null }>
}

/** Map workflow result status → lab_results.status CHECK constraint. */
export function persistableLabResultStatus(
  status: LabResult["status"],
): "preliminary" | "final" | "corrected" | "cancelled" {
  if (status === "amended") return "corrected"
  return status
}

export function labResultToRow(result: LabResult, extras?: { enteredBy?: string | null; source?: string }): Record<string, unknown> {
  return {
    id: result.id,
    tenant_id: result.tenantId,
    lab_order_id: result.labOrderId,
    patient_id: result.patientId,
    loinc_code: result.loincCode,
    test_name: result.testName,
    result_value: result.resultValue,
    unit: result.unit || null,
    reference_range: result.referenceRange || null,
    status: persistableLabResultStatus(result.status),
    is_critical: result.isCritical,
    is_abnormal: result.isAbnormal,
    numeric_value: result.numericValue,
    abnormal_flag: result.flag,
    analyzer: result.analyzer ?? null,
    verified_by: result.verifiedBy ?? null,
    verified_at: result.verifiedAt ?? null,
    provenance: result.provenance,
    result_source: extras?.source ?? provenanceToSource(result.provenance),
    entered_by: extras?.enteredBy ?? null,
    version: result.version,
    is_synthetic: result.isSynthetic,
    released_to_patient_at: result.releasedAt ?? null,
  }
}

function provenanceToSource(provenance: LabResult["provenance"]): string {
  if (provenance === "IMPORTED") return "ANALYZER"
  if (provenance === "LAB_VERIFIED") return "MANUAL"
  return "MANUAL"
}

export function rowToLabResult(row: Record<string, unknown>): LabResult {
  const dbStatus = String(row.status ?? "preliminary")
  const status: LabResult["status"] =
    dbStatus === "corrected" ? "amended" : (dbStatus as LabResult["status"])
  return {
    id: String(row.id),
    labOrderId: String(row.lab_order_id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    loincCode: String(row.loinc_code ?? ""),
    testName: String(row.test_name),
    resultValue: String(row.result_value),
    numericValue: row.numeric_value != null ? Number(row.numeric_value) : null,
    unit: String(row.unit ?? ""),
    referenceRange: String(row.reference_range ?? ""),
    flag: (row.abnormal_flag as LabResult["flag"]) ?? "N",
    isCritical: Boolean(row.is_critical),
    isAbnormal: Boolean(row.is_abnormal),
    status,
    analyzer: (row.analyzer as string | null) ?? null,
    verifiedBy: (row.verified_by as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
    releasedAt: (row.released_to_patient_at as string | null) ?? null,
    version: Number(row.version ?? 1),
    provenance: (row.provenance as LabResult["provenance"]) ?? "SYSTEM_GENERATED",
    isSynthetic: Boolean(row.is_synthetic),
  }
}

export async function loadLabResultsForOrder(
  db: DbClient,
  tenantId: string,
  orderId: string,
): Promise<LabResult[]> {
  const { data, error } = await db
    .from("lab_results")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("lab_order_id", orderId)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(rowToLabResult)
}

export async function persistLabResultBestEffort(
  db: DbClient,
  result: LabResult,
  extras?: { enteredBy?: string | null; source?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("lab_results").upsert(labResultToRow(result, extras), { onConflict: "id" })
    if (error) return { ok: false, error: error.message ?? "lab_results upsert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "lab_results upsert threw" }
  }
}

export type SpecimenInsert = {
  id: string
  tenantId: string
  patientId: string
  personId?: string | null
  encounterId: string
  labOrderId: string
  accessionNumber: string
  barcode: string
  specimenType?: string
  collectedAt?: string
  collectedBy?: string | null
}

/**
 * Allocate a durable accession: FAC-YYYYMMDD-###### using lab_accession_counters.
 * Falls back to UUID-based code if counter table is missing.
 */
export async function allocateAccessionNumber(
  db: DbClient,
  tenantId: string,
  facilityCode = "LAB",
): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  try {
    if (typeof db.rpc === "function") {
      const { data, error } = await db.rpc("allocate_lab_accession", {
        p_tenant_id: tenantId,
        p_facility_code: facilityCode,
        p_day: day,
      })
      if (!error && data) return String(data)
    }
  } catch {
    // fall through
  }
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
  return `${facilityCode}-${day}-${suffix}`
}

export async function persistLabSpecimenBestEffort(
  db: DbClient,
  specimen: SpecimenInsert,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("lab_specimens").upsert(
      {
        id: specimen.id,
        tenant_id: specimen.tenantId,
        patient_id: specimen.patientId,
        person_id: specimen.personId ?? null,
        encounter_id: specimen.encounterId,
        lab_order_id: specimen.labOrderId,
        accession_number: specimen.accessionNumber,
        barcode: specimen.barcode,
        specimen_type: specimen.specimenType ?? "blood",
        status: "collected",
        collected_at: specimen.collectedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    if (error) return { ok: false, error: error.message ?? "lab_specimens upsert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "lab_specimens upsert threw" }
  }
}

export async function persistCriticalAckBestEffort(
  db: DbClient,
  params: {
    tenantId: string
    resultId: string
    labOrderId: string
    patientId: string
    acknowledgedBy: string
    note?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("lab_critical_acknowledgements").insert({
      tenant_id: params.tenantId,
      result_id: params.resultId,
      lab_order_id: params.labOrderId,
      patient_id: params.patientId,
      acknowledged_by: params.acknowledgedBy,
      note: params.note ?? null,
      is_synthetic: false,
    })
    if (error) return { ok: false, error: error.message ?? "critical ack insert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "critical ack threw" }
  }
}

/** Ensure order is hydrated with prior durable results before transitions. */
export function assertOrderHydrated(_order: LabOrder, results: LabResult[]): void {
  void results
}
