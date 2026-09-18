import { NextRequest, NextResponse } from "next/server"
import {
  classifyFhirHttpType,
  searchBundle,
  toFhirDiagnosticReport,
  toFhirObservation,
  toFhirSpecimen,
} from "@synapse/interop"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import { supabaseAdmin } from "@synapse/db/admin"

function operationOutcome(diagnostics: string, status: number, code = "processing") {
  return NextResponse.json(
    {
      resourceType: "OperationOutcome",
      issue: [{ severity: status >= 500 ? "error" : "information", code, diagnostics }],
    },
    { status },
  )
}

export async function requireFhirTenant() {
  const user = await getCurrentUser()
  if (!user) return { error: operationOutcome("Authentication required", 401, "login") }
  if (!user.tenantId) return { error: operationOutcome("Tenant context required", 403, "forbidden") }
  return { user }
}

export function classifyFhirType(resource: string) {
  return classifyFhirHttpType(resource)
}

export async function handleFhirSearch(req: NextRequest, resource: string) {
  const classified = classifyFhirType(resource)
  if (classified === "unimplemented" || classified === "flagship_unproven") {
    return operationOutcome(
      `${resource} is not advertised on the SYNAPSE CapabilityStatement. Lab-backed Observation, Specimen, and DiagnosticReport are the proven subset.`,
      501,
      "not-supported",
    )
  }
  if (classified === "unknown") {
    return operationOutcome(`Unsupported FHIR resource type ${resource}`, 404, "not-found")
  }
  const auth = await requireFhirTenant()
  if ("error" in auth && auth.error) return auth.error
  const db = supabaseAdmin as any
  if (resource === "DiagnosticReport") {
    const { data, error } = await db
      .from("lab_reports")
      .select("id, patient_id, clinical_result_id, lab_order_id, status, version, released_at, lab_orders!inner(loinc_code, test_name, tenant_id)")
      .eq("tenant_id", auth.user.tenantId)
      .in("status", ["FINAL", "AMENDED"])
      .order("released_at", { ascending: false })
      .limit(100)
    if (error) return operationOutcome(error.message, 500)
    const resources = (data ?? []).map((row: Record<string, unknown>) => {
      const order = Array.isArray(row.lab_orders) ? row.lab_orders[0] : row.lab_orders as Record<string, unknown>
      return toFhirDiagnosticReport({
        id: String(row.id),
        patientId: String(row.patient_id),
        observationIds: [String(row.clinical_result_id)],
        code: String(order?.loinc_code ?? ""),
        display: String(order?.test_name ?? "Laboratory result"),
        tenantId: auth.user.tenantId!,
      })
    })
    return NextResponse.json(searchBundle(resources))
  }
  if (resource === "Observation") {
    const { data, error } = await db
      .from("lab_results")
      .select("id, patient_id, loinc_code, test_name, result_value, unit, reference_range, abnormal_flag, verified_at, released_to_patient_at, status")
      .eq("tenant_id", auth.user.tenantId)
      .eq("status", "final")
      .not("released_to_patient_at", "is", null)
      .limit(100)
    if (error) return operationOutcome(error.message, 500)
    const resources = (data ?? []).map((row: Record<string, unknown>) => toFhirObservation({
      resourceType: "Observation",
      id: String(row.id),
      personId: String(row.patient_id),
      code: String(row.loinc_code ?? ""),
      display: String(row.test_name ?? "Observation"),
      value: String(row.result_value ?? ""),
      unit: row.unit as string | undefined,
      referenceRange: row.reference_range as string | undefined,
      provenance: "LAB_VERIFIED",
    }, auth.user.tenantId!))
    return NextResponse.json(searchBundle(resources))
  }
  if (resource === "Specimen") {
    const { data, error } = await db
      .from("lab_specimens")
      .select("id, accession_number, barcode, patient_id, specimen_type, lab_order_id, encounter_id")
      .eq("tenant_id", auth.user.tenantId)
      .limit(100)
    if (error) return operationOutcome(error.message, 500)
    const resources = (data ?? []).map((row: Record<string, unknown>) => toFhirSpecimen({
      resourceType: "Specimen",
      id: String(row.id),
      accession: String(row.accession_number ?? row.id),
      barcode: row.barcode as string | undefined,
      personId: String(row.patient_id ?? ""),
      orderId: row.lab_order_id as string | undefined,
      encounterId: row.encounter_id as string | undefined,
      type: row.specimen_type as string | undefined,
    }, auth.user.tenantId!))
    return NextResponse.json(searchBundle(resources))
  }
  void req
  return operationOutcome(`${resource} search is not implemented`, 501, "not-supported")
}

export async function handleFhirRead(_req: NextRequest, resource: string, id: string) {
  const classified = classifyFhirType(resource)
  if (classified === "unimplemented" || classified === "flagship_unproven") {
    return operationOutcome(
      `${resource} is not advertised on the SYNAPSE CapabilityStatement. Lab-backed Observation, Specimen, and DiagnosticReport are the proven subset.`,
      501,
      "not-supported",
    )
  }
  if (classified === "unknown") {
    return operationOutcome(`Unsupported FHIR resource type ${resource}`, 404, "not-found")
  }
  const auth = await requireFhirTenant()
  if ("error" in auth && auth.error) return auth.error
  if (!id) return operationOutcome("Resource id required", 400, "required")
  const db = supabaseAdmin as any
  if (resource === "Observation") {
    const { data, error } = await db
      .from("lab_results")
      .select("id, patient_id, loinc_code, test_name, result_value, unit, reference_range, abnormal_flag, verified_at, released_to_patient_at, status, lab_order_id, lab_orders!inner(tenant_id)")
      .eq("id", id)
      .eq("tenant_id", auth.user.tenantId)
      .eq("status", "final")
      .not("released_to_patient_at", "is", null)
      .maybeSingle()
    if (error) return operationOutcome(error.message, 500)
    if (!data) return operationOutcome(`Observation/${id} was not found`, 404, "not-found")
    return NextResponse.json(toFhirObservation({
      resourceType: "Observation",
      id: String(data.id),
      personId: String(data.patient_id),
      code: String(data.loinc_code),
      display: String(data.test_name),
      value: String(data.result_value),
      unit: data.unit as string | undefined,
      referenceRange: data.reference_range as string | undefined,
      interpretation: data.abnormal_flag === "CRIT" ? "AA" : data.abnormal_flag as "N" | "H" | "L" | "HH" | "LL" | "A" | "AA" | undefined,
      provenance: "LAB_VERIFIED",
    }, auth.user.tenantId!))
  }
  if (resource === "Specimen") {
    const { data, error } = await db
      .from("lab_specimens")
      .select("id, accession_number, barcode, patient_id, specimen_type, lab_order_id, encounter_id")
      .eq("id", id)
      .eq("tenant_id", auth.user.tenantId)
      .maybeSingle()
    if (error) return operationOutcome(error.message, 500)
    if (!data) return operationOutcome(`Specimen/${id} was not found`, 404, "not-found")
    return NextResponse.json(toFhirSpecimen({
      resourceType: "Specimen",
      id: String(data.id),
      accession: String(data.accession_number),
      barcode: data.barcode as string | undefined,
      personId: String(data.patient_id),
      orderId: data.lab_order_id as string | undefined,
      encounterId: data.encounter_id as string | undefined,
      type: data.specimen_type as string | undefined,
    }, auth.user.tenantId!))
  }
  if (resource === "DiagnosticReport") {
    const { data, error } = await db
      .from("lab_reports")
      .select("id, patient_id, clinical_result_id, lab_order_id, status, lab_orders!inner(tenant_id, loinc_code, test_name)")
      .eq("id", id)
      .eq("tenant_id", auth.user.tenantId)
      .in("status", ["FINAL", "AMENDED"])
      .maybeSingle()
    if (error) return operationOutcome(error.message, 500)
    if (!data) return operationOutcome(`DiagnosticReport/${id} was not found`, 404, "not-found")
    const order = Array.isArray(data.lab_orders) ? data.lab_orders[0] : data.lab_orders as Record<string, unknown>
    return NextResponse.json(toFhirDiagnosticReport({
      id: String(data.id),
      patientId: String(data.patient_id),
      observationIds: [String(data.clinical_result_id)],
      code: String(order?.loinc_code ?? ""),
      display: String(order?.test_name ?? "Laboratory result"),
      tenantId: auth.user.tenantId!,
    }))
  }
  return operationOutcome(`${resource}/${id} was not found in tenant ${auth.user?.tenantId}`, 404, "not-found")
}
