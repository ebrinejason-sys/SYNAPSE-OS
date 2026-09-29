export type TriageStage = 'RED' | 'YELLOW' | 'GREEN'

export type TriageFormState = {
  patientId: string
  complaint: string
  stage?: TriageStage | ''
  temperature?: string
  heartRate?: string
  bpSystolic?: string
  bpDiastolic?: string
  spo2?: string
}

const num = (v?: string) => (v && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined)

/**
 * Body for POST /api/opd/triage. `clinical_stage` is the triage acuity
 * (RED/YELLOW/GREEN) only. An AI differential / diagnosis is NOT a triage
 * stage and must never be sent here (the API rejects it with 400).
 */
export function buildTriagePayload(s: TriageFormState) {
  return {
    patient_id: s.patientId,
    chief_complaint: s.complaint.trim(),
    clinical_stage: s.stage ? s.stage : undefined,
    temperature_c: num(s.temperature),
    heart_rate: num(s.heartRate),
    bp_systolic: num(s.bpSystolic),
    bp_diastolic: num(s.bpDiastolic),
    spo2: num(s.spo2),
  }
}

export function triageErrorMessage(status: number, body: unknown): string {
  const b = body as { error?: unknown; message?: string } | null
  if (typeof b?.error === 'string') return b.message ? `${b.error}: ${b.message}` : b.error
  const fe = (b?.error as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors
  if (fe) {
    const first = Object.entries(fe).find(([, v]) => v?.length)
    if (first) return `${first[0]}: ${first[1][0]}`
  }
  return `Could not save encounter (HTTP ${status})`
}
