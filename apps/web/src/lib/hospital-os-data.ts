import "server-only"

import { supabaseAdmin } from "@synapse/db/admin"

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

export async function listHospitalPatients(tenantId: string, q?: string) {
  let query = db()
    .from("patients")
    .select("id, full_name, date_of_birth, sex, mrn, created_at")
    .eq("tenant_id", tenantId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50)
  if (q) query = query.ilike("full_name", `%${q}%`)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    full_name: string
    date_of_birth: string | null
    sex: string | null
    mrn: string | null
    created_at: string
  }>
}

export async function getHospitalPatientChart(tenantId: string, patientId: string) {
  const client = db()
  const { data: patient, error: patientError } = await client
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (patientError) throw new Error(patientError.message)
  if (!patient) return null

  const { data: encounters, error: encounterError } = await client
    .from("encounters")
    .select("id, visit_date, status, chief_complaint, clinical_stage")
    .eq("patient_id", patientId)
    .eq("tenant_id", tenantId)
    .order("visit_date", { ascending: false })
    .limit(10)
  if (encounterError) throw new Error(encounterError.message)

  const { data: vitals, error: vitalsError } = await client
    .from("vitals")
    .select("bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, respiratory_rate, created_at")
    .eq("patient_id", patientId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
  if (vitalsError) throw new Error(vitalsError.message)

  return {
    patient,
    encounters: encounters ?? [],
    latestVitals: (vitals?.[0] as Record<string, unknown> | undefined) ?? null,
  }
}

export async function countHospitalCensus(tenantId: string) {
  const client = db()
  const [patientRes, encounterRes] = await Promise.all([
    client
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_deleted", false),
    client
      .from("encounters")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ])
  return {
    patients: patientRes.count ?? 0,
    encounters: encounterRes.count ?? 0,
  }
}
