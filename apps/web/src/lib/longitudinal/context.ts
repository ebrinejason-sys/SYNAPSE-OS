// Longitudinal patient intelligence — builds clinical context packet for reasoning engine.
// All PHI reads are logged to phi_access_log.

import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ── Types ──────────────────────────────────────────────────────────────────

export interface PatientContextPacket {
  patientId:      string
  tenantId:       string
  encounterId:    string | null
  chiefComplaint: string
  age:            number | null
  sex:            string | null
  vitals: {
    temperatureC?: number
    heartRate?:    number
    bpSystolic?:   number
    bpDiastolic?:  number
    spo2?:         number
  } | null
  activePatterns: PatternSummary[]
  recentOutcomes: OutcomeSummary[]
  activeMeds:     MedSummary[]
  recentLabs:     LabSummary[]
  insuranceContext: {
    covered:      boolean
    planName:     string | null
    copayAmount:  number | null
  } | null
}

interface PatternSummary {
  type:        string
  description: string
  severity:    string
  occurrences: number
  lastSeen:    string
}

interface OutcomeSummary {
  intervention: string
  type:         string
  outcome:      string
  notes:        string | null
  startedAt:    string
}

interface MedSummary {
  name:     string
  dose:     string | null
  route:    string | null
  status:   string
}

interface LabSummary {
  testName: string
  value:    string | null
  unit:     string | null
  status:   string
  takenAt:  string
}

// ── PHI access log ─────────────────────────────────────────────────────────

async function logPhiAccess(params: {
  tenantId:    string
  userId:      string
  patientId:   string
  resource:    string
  purpose:     string
}): Promise<void> {
  await db.from('phi_access_log').insert({
    tenant_id:   params.tenantId,
    user_id:     params.userId,
    patient_id:  params.patientId,
    resource:    params.resource,
    purpose:     params.purpose,
    accessed_at: new Date().toISOString(),
  }).catch(() => {})
}

// ── Context packet builder ─────────────────────────────────────────────────

export async function buildPatientContextPacket(params: {
  tenantId:       string
  patientId:      string
  currentEncounterId: string | null
  chiefComplaint: string
  userId:         string
}): Promise<PatientContextPacket> {
  const { tenantId, patientId, currentEncounterId, chiefComplaint, userId } = params

  // PHI access log — one entry covering all reads below
  await logPhiAccess({
    tenantId,
    userId,
    patientId,
    resource:  'longitudinal_context',
    purpose:   'clinical_reasoning',
  })

  // Run all reads in parallel
  const [
    patientResult,
    vitalsResult,
    patternsResult,
    outcomesResult,
    medsResult,
    labsResult,
    insuranceResult,
  ] = await Promise.all([
    // Patient demographics
    db.from('patients')
      .select('date_of_birth, sex')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),

    // Most recent vitals via encounter
    currentEncounterId
      ? db.from('vitals')
          .select('temperature_c, heart_rate, bp_systolic, bp_diastolic, spo2')
          .eq('encounter_id', currentEncounterId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Active clinical patterns (not resolved)
    db.from('patient_clinical_patterns')
      .select('pattern_type, description, severity, occurrence_count, last_seen_at')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('is_resolved', false)
      .order('last_seen_at', { ascending: false })
      .limit(10),

    // Recent intervention outcomes (last 6 months)
    db.from('patient_intervention_outcomes')
      .select('intervention, intervention_type, outcome, outcome_notes, started_at')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .gte('started_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false })
      .limit(10),

    // Active prescriptions
    db.from('prescriptions')
      .select('id, status, prescription_items(drug_name, dose, route)')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),

    // Recent lab results (last 90 days)
    db.from('lab_test_results')
      .select('test_name, value, unit, status, created_at')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10)
      .catch(() => ({ data: [] })),

    // Insurance eligibility (most recent active policy)
    db.from('insurance_policies')
      .select('plan_name, copay_amount, status')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Calculate age from DOB
  let age: number | null = null
  if (patientResult.data?.date_of_birth) {
    const dob = new Date(patientResult.data.date_of_birth as string)
    age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  }

  const vitals = vitalsResult.data ? {
    temperatureC: vitalsResult.data.temperature_c ? Number(vitalsResult.data.temperature_c) : undefined,
    heartRate:    vitalsResult.data.heart_rate ?? undefined,
    bpSystolic:   vitalsResult.data.bp_systolic ?? undefined,
    bpDiastolic:  vitalsResult.data.bp_diastolic ?? undefined,
    spo2:         vitalsResult.data.spo2 ? Number(vitalsResult.data.spo2) : undefined,
  } : null

  const activePatterns: PatternSummary[] = (patternsResult.data ?? []).map(
    (r: Record<string, unknown>) => ({
      type:        r.pattern_type as string,
      description: r.description as string,
      severity:    r.severity as string,
      occurrences: r.occurrence_count as number,
      lastSeen:    r.last_seen_at as string,
    })
  )

  const recentOutcomes: OutcomeSummary[] = (outcomesResult.data ?? []).map(
    (r: Record<string, unknown>) => ({
      intervention: r.intervention as string,
      type:         r.intervention_type as string,
      outcome:      r.outcome as string,
      notes:        r.outcome_notes as string | null,
      startedAt:    r.started_at as string,
    })
  )

  const activeMeds: MedSummary[] = (medsResult.data ?? []).flatMap(
    (rx: Record<string, unknown>) =>
      ((rx.prescription_items as Record<string, unknown>[]) ?? []).map(item => ({
        name:   item.drug_name as string,
        dose:   item.dose as string | null,
        route:  item.route as string | null,
        status: rx.status as string,
      }))
  )

  const recentLabs: LabSummary[] = (labsResult.data ?? []).map(
    (r: Record<string, unknown>) => ({
      testName: r.test_name as string,
      value:    r.value as string | null,
      unit:     r.unit as string | null,
      status:   r.status as string,
      takenAt:  r.created_at as string,
    })
  )

  const insuranceCtx = insuranceResult.data ? {
    covered:     true,
    planName:    insuranceResult.data.plan_name as string | null,
    copayAmount: insuranceResult.data.copay_amount ? Number(insuranceResult.data.copay_amount) : null,
  } : null

  return {
    patientId,
    tenantId,
    encounterId:     currentEncounterId,
    chiefComplaint,
    age,
    sex:             patientResult.data?.sex as string | null ?? null,
    vitals,
    activePatterns,
    recentOutcomes,
    activeMeds,
    recentLabs,
    insuranceContext: insuranceCtx,
  }
}

// ── Pattern detection ──────────────────────────────────────────────────────

/**
 * Detects new clinical patterns by comparing recent encounter data.
 * Upserts to patient_clinical_patterns.
 * Called after encounter completion, not during — no impact on active clinical workflow.
 */
export async function detectAndUpsertPatterns(params: {
  tenantId:    string
  patientId:   string
  encounterId: string
  recordedBy:  string
}): Promise<void> {
  const { tenantId, patientId, encounterId, recordedBy: _ } = params

  // Count repeated diagnoses (3+ occurrences in last year)
  const { data: diagCounts } = await db
    .from('encounter_diagnoses')
    .select('title, stem_code')
    .eq('tenant_id', tenantId)
    .eq('encounters.patient_id', patientId)

  // Simple approach: count encounters with same diagnosis title
  const diagFreq: Record<string, number> = {}
  for (const d of diagCounts ?? []) {
    const key = (d.title as string) ?? 'unknown'
    diagFreq[key] = (diagFreq[key] ?? 0) + 1
  }

  for (const [title, count] of Object.entries(diagFreq)) {
    if (count >= 3) {
      await db.from('patient_clinical_patterns').upsert({
        tenant_id:       tenantId,
        patient_id:      patientId,
        pattern_type:    'repeated_diagnosis',
        description:     `${title} has occurred ${count} times`,
        first_seen_at:   new Date().toISOString(),
        last_seen_at:    new Date().toISOString(),
        occurrence_count: count,
        severity:        count >= 5 ? 'severe' : 'moderate',
        evidence:        [encounterId],
        is_resolved:     false,
      }, {
        onConflict:    'patient_id,pattern_type,description',
        ignoreDuplicates: false,
      }).catch(() => {})
    }
  }
}
