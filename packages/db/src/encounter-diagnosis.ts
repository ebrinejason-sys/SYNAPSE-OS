/**
 * Row for public.encounter_diagnoses. Uses columns that already exist.
 * A stem-only clinician selection stores the stem in cluster_code because
 * that column is NOT NULL and a single stem is a one-member cluster.
 * created_by is omitted: it references auth.users, and selected_by is the
 * profile actor.
 */

export type EncounterDiagnosisInput = {
  encounterId: string
  tenantId: string
  selectedBy: string
  stemCode: string
  title: string
  foundationUri?: string | null
  linearizationUri?: string | null
  release?: string | null
}

export function encounterDiagnosisRow(input: EncounterDiagnosisInput) {
  const stem = input.stemCode.trim()
  return {
    encounter_id: input.encounterId,
    tenant_id: input.tenantId,
    stem_code: stem,
    cluster_code: stem,
    title: input.title,
    certainty: "confirmed" as const,
    diagnosis_type: "primary" as const,
    foundation_uri: input.foundationUri ?? null,
    linearization_uri: input.linearizationUri ?? null,
    icd_release: input.release ?? "2026-01",
    selected_by: input.selectedBy,
    suggested_by: "clinician" as const,
    is_deleted: false,
  }
}
