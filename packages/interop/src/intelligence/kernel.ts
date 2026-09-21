/**
 * SYNAPSE Intelligence kernel.
 *
 * One governed gateway. Task-specific copilots are views over the same
 * recommendation schema. AI never signs diagnoses, releases labs, dispenses,
 * or submits claims. AI never invents ICD-11 codes.
 */

import { searchIcd11, type Icd11SearchHit } from "../terminology/icd11"

export const INTELLIGENCE_PROMPT_VERSION = "golden.kernel.v1"
export const INTELLIGENCE_FORBIDDEN_ACTIONS = [
  "sign_diagnosis",
  "release_lab_result",
  "dispense_medication",
  "submit_insurance_claim",
  "pronounce_death",
  "certify_death",
  "release_body",
  "activate_pathway",
  "place_order",
  "prescribe",
  "sign",
] as const

export const INTELLIGENCE_TASKS = [
  "clinical_copilot",
  "coding_copilot",
  "pathway_copilot",
  "lab_interpretation",
  "insurance_copilot",
  "operations_copilot",
] as const

export type IntelligenceTask = (typeof INTELLIGENCE_TASKS)[number]
export type ClinicianDecision = "ACCEPT" | "MODIFY" | "REJECT" | "DEFER"

export type PatientContextPacket = {
  patientId: string
  tenantId: string
  /** Facility scope for public-health aggregation (never exported raw) */
  facilityId?: string | null
  encounterId?: string | null
  clinicianId: string
  demographics?: { age?: number | null; sex?: string | null; display?: string }
  presentingComplaint: string
  history?: string[]
  examination?: string[]
  vitals?: Record<string, number | string | undefined>
  previousDiagnoses?: string[]
  /** Clinician-verified ICD-11 only — used for aggregate public-health counts */
  confirmedDiagnoses?: Array<{ stemCode: string; title?: string; verified: boolean }>
  medications?: string[]
  allergies?: string[]
  laboratory?: Array<{ test: string; value: string; flag?: string }>
  imaging?: string[]
  previousEncounters?: string[]
  activePathwayId?: string | null
  insuranceContext?: { planName?: string | null; covered?: boolean }
  /** Village / parish / sub-county — for surveillance locality, never raw-exported */
  locality?: {
    village?: string | null
    parish?: string | null
    subCounty?: string | null
    district?: string | null
  } | null
  /** Period grain for rollup (YYYYMM / YYYYMMDD) — set by export builder, not UI */
  aggregatePeriod?: string | null
  guidelineContext?: string | null
}

export type StructuredRecommendation = {
  id: string
  task: IntelligenceTask
  recommendation: string
  reasoningSummary: string
  supportingEvidence: string[]
  contradictingEvidence: string[]
  missingInformation: string[]
  confidence: number
  cannotMiss: boolean
  proposedTerms: string[]
  icd11Candidates: Icd11SearchHit[]
  suggestedPathwayId: string | null
  provenance: {
    model: string | null
    promptVersion: string
    toolVersion: string
    sources: string[]
  }
}

export type ClinicianActionRecord = {
  recommendationId: string
  decision: ClinicianDecision
  clinicianId: string
  reason?: string | null
  modifiedText?: string | null
  at: string
}

export type DifferentialProposal = {
  conditionName: string
  icd11Code?: string | null
  icd11Uri?: string | null
  priorProbability?: number
  harmIfMissed?: number
  cantMiss?: boolean
  aiReasoning?: string
  confidence?: number
}

export const PATHWAY_TERM_MAP: Array<{ pattern: RegExp; pathwayId: string }> = [
  { pattern: /sepsis|septic shock|qsofa/i, pathwayId: "pathway.adult-sepsis" },
  { pattern: /severe malaria|prostration|artesunate/i, pathwayId: "pathway.severe-malaria" },
  { pattern: /malaria|falciparum|plasmodium/i, pathwayId: "pathway.malaria" },
  { pattern: /ketoacidosis|\bdka\b|diabetic keto/i, pathwayId: "pathway.dka" },
  { pattern: /pneumonia|hypox/i, pathwayId: "pathway.pneumonia" },
  { pattern: /hypertensive emergency|encephalopath/i, pathwayId: "pathway.hypertensive-emergency" },
  { pattern: /acute coronary|stemi|nstemi|troponin/i, pathwayId: "pathway.acs" },
  { pattern: /stroke|hemiparesis|facial droop/i, pathwayId: "pathway.stroke" },
  { pattern: /asthma/i, pathwayId: "pathway.asthma-exacerbation" },
  { pattern: /\bcopd\b/i, pathwayId: "pathway.copd-exacerbation" },
  { pattern: /heart failure|pulmonary oedema|pulmonary edema/i, pathwayId: "pathway.acute-heart-failure" },
  { pattern: /\baki\b|acute kidney|hyperkalaem/i, pathwayId: "pathway.aki" },
  { pattern: /meningitis|neck stiffness|photophobia/i, pathwayId: "pathway.meningitis" },
  { pattern: /haematemesis|hematemesis|melaena|melena|gi bleed/i, pathwayId: "pathway.upper-gi-bleed" },
  { pattern: /poison|organophosphate|toxin/i, pathwayId: "pathway.poisoning" },
  { pattern: /snakebite|snake bite|envenom/i, pathwayId: "pathway.snakebite" },
  { pattern: /trauma|rta|gunshot|stab/i, pathwayId: "pathway.trauma" },
  { pattern: /\btb\b|tuberculosis/i, pathwayId: "pathway.tuberculosis" },
  { pattern: /\bhiv\b|antiretroviral/i, pathwayId: "pathway.hiv" },
  { pattern: /anaemia|anemia|pallor/i, pathwayId: "pathway.anaemia" },
  { pattern: /neonat|newborn|asphyxia/i, pathwayId: "pathway.neonatal-emergency" },
  { pattern: /obstetric h(ae)?morrhage|antepartum bleed/i, pathwayId: "pathway.obstetric-hemorrhage" },
  { pattern: /pre-?eclampsia|eclampsia/i, pathwayId: "pathway.pre-eclampsia" },
  { pattern: /postpartum h(ae)?morrhage|\bpph\b/i, pathwayId: "pathway.postpartum-hemorrhage" },
]

export function suggestPathway(terms: string[]): string | null {
  const hay = terms.join(" ")
  return PATHWAY_TERM_MAP.find((row) => row.pattern.test(hay))?.pathwayId ?? null
}

/** Drop model-emitted ICD codes. Terminology service is the only coder. */
export function stripInventedIcdCodes<T extends DifferentialProposal>(proposal: T): T {
  return { ...proposal, icd11Code: null, icd11Uri: null }
}

export function assertNotForbidden(action: string): void {
  if ((INTELLIGENCE_FORBIDDEN_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`INTELLIGENCE_FORBIDDEN:${action}`)
  }
}

export function contextSummary(packet: PatientContextPacket): string {
  const demo = packet.demographics
  const who = [demo?.age != null ? `${demo.age}-year-old` : null, demo?.sex, demo?.display]
    .filter(Boolean)
    .join(" ")
  const vitals = packet.vitals
    ? Object.entries(packet.vitals)
        .filter(([, value]) => value != null && value !== "")
        .map(([key, value]) => `${key} ${value}`)
        .join(", ")
    : "vitals not recorded"
  const labs = packet.laboratory?.map((row) => `${row.test} ${row.value}${row.flag ? ` (${row.flag})` : ""}`).join("; ")
  const parts = [
    who || "patient",
    `presenting: ${packet.presentingComplaint}`,
    packet.history?.length ? `history: ${packet.history.join("; ")}` : null,
    packet.examination?.length ? `exam: ${packet.examination.join("; ")}` : null,
    `vitals: ${vitals}`,
    packet.previousDiagnoses?.length ? `previous diagnoses: ${packet.previousDiagnoses.join("; ")}` : null,
    packet.medications?.length ? `medications: ${packet.medications.join("; ")}` : null,
    packet.allergies?.length ? `allergies: ${packet.allergies.join("; ")}` : null,
    labs ? `labs: ${labs}` : null,
    packet.imaging?.length ? `imaging: ${packet.imaging.join("; ")}` : null,
    packet.activePathwayId ? `active pathway: ${packet.activePathwayId}` : null,
    packet.insuranceContext?.planName ? `insurance: ${packet.insuranceContext.planName}` : null,
    packet.guidelineContext ? `guidelines: ${packet.guidelineContext}` : null,
  ]
  return parts.filter(Boolean).join(". ")
}

export function buildRecommendation(params: {
  id: string
  task: IntelligenceTask
  proposal: DifferentialProposal
  packet: PatientContextPacket
  model?: string | null
}): StructuredRecommendation {
  const cleaned = stripInventedIcdCodes(params.proposal)
  const supporting = [
    params.packet.presentingComplaint,
    ...(params.packet.examination ?? []),
    ...(params.packet.laboratory ?? []).map((row) => `${row.test} ${row.value}`),
  ].filter(Boolean)
  const missing: string[] = []
  if (!params.packet.vitals) missing.push("vitals")
  if (!params.packet.laboratory?.length) missing.push("laboratory results")
  const candidates = searchIcd11(cleaned.conditionName)
  return {
    id: params.id,
    task: params.task,
    recommendation: cleaned.conditionName,
    reasoningSummary: cleaned.aiReasoning || `Consider ${cleaned.conditionName} given the recorded context.`,
    supportingEvidence: supporting,
    contradictingEvidence: (params.packet.allergies ?? []).map((item) => `allergy: ${item}`),
    missingInformation: missing,
    confidence: Math.max(0, Math.min(1, Number(cleaned.confidence) || 0.4)),
    cannotMiss: Boolean(cleaned.cantMiss) || Number(cleaned.harmIfMissed) >= 0.8,
    proposedTerms: [cleaned.conditionName],
    icd11Candidates: candidates,
    suggestedPathwayId: suggestPathway([cleaned.conditionName, params.packet.presentingComplaint]),
    provenance: {
      model: params.model ?? null,
      promptVersion: INTELLIGENCE_PROMPT_VERSION,
      toolVersion: INTELLIGENCE_PROMPT_VERSION,
      sources: ["patient_context_packet", "icd11_seed_cache"],
    },
  }
}

export function recordClinicianDecision(params: {
  recommendationId: string
  decision: ClinicianDecision
  clinicianId: string
  reason?: string | null
  modifiedText?: string | null
}): ClinicianActionRecord {
  if ((params.decision === "REJECT" || params.decision === "MODIFY") && !params.reason?.trim()) {
    throw new Error("CLINICIAN_REASON_REQUIRED")
  }
  return {
    recommendationId: params.recommendationId,
    decision: params.decision,
    clinicianId: params.clinicianId,
    reason: params.reason ?? null,
    modifiedText: params.modifiedText ?? null,
    at: new Date().toISOString(),
  }
}

export function authorizePacketTenant(packet: PatientContextPacket, sessionTenantId: string | null | undefined): void {
  if (!sessionTenantId) throw new Error("TENANT_CONTEXT_REQUIRED")
  if (packet.tenantId !== sessionTenantId) throw new Error("TENANT_MISMATCH")
}

export function assertCallerCannotSupplyTenant(bodyTenantId: unknown, sessionTenantId: string): void {
  if (bodyTenantId && bodyTenantId !== sessionTenantId) {
    throw new Error("CALLER_TENANT_REJECTED")
  }
}
