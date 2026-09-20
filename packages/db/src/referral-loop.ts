import type { FacilityReferral } from "./referral-lifecycle"
import { createClinicalDocument, type ClinicalDocument } from "./clinical-documents"

/**
 * Closed-loop overlay on existing facility_referrals statuses.
 * Historical rows stay pending/accepted/rejected/cancelled/completed.
 * Loop stages are derived plus optional timestamps; they do not replace the check constraint.
 */
export const REFERRAL_LOOP_STAGES = [
  "created",
  "sent",
  "received",
  "accepted",
  "arrived",
  "seen",
  "feedback_returned",
  "completed",
  "rejected",
  "cancelled",
] as const

export type ReferralLoopStage = (typeof REFERRAL_LOOP_STAGES)[number]

export type ReferralLoopState = {
  referralId: string
  storedStatus: FacilityReferral["status"]
  stage: ReferralLoopStage
  sentAt?: string | null
  receivedAt?: string | null
  arrivedAt?: string | null
  seenAt?: string | null
  feedback?: string | null
  counterReferralId?: string | null
}

export function loopStageFromStoredStatus(status: FacilityReferral["status"]): ReferralLoopStage {
  if (status === "pending") return "created"
  if (status === "accepted") return "accepted"
  if (status === "completed") return "completed"
  if (status === "rejected") return "rejected"
  return "cancelled"
}

export const REFERRAL_LOOP_TRANSITIONS: Record<ReferralLoopStage, ReferralLoopStage[]> = {
  created: ["sent", "cancelled"],
  sent: ["received", "cancelled"],
  received: ["accepted", "rejected", "cancelled"],
  accepted: ["arrived", "cancelled"],
  arrived: ["seen", "cancelled"],
  seen: ["feedback_returned", "completed"],
  feedback_returned: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
}

export function storedStatusForLoopStage(stage: ReferralLoopStage): FacilityReferral["status"] {
  if (stage === "accepted" || stage === "arrived" || stage === "seen" || stage === "feedback_returned") return "accepted"
  if (stage === "completed") return "completed"
  if (stage === "rejected") return "rejected"
  if (stage === "cancelled") return "cancelled"
  return "pending"
}

export function advanceReferralLoop(state: ReferralLoopState, to: ReferralLoopStage, at = new Date().toISOString()): ReferralLoopState {
  if (!REFERRAL_LOOP_TRANSITIONS[state.stage]?.includes(to)) throw new Error("REFERRAL_LOOP_INVALID_TRANSITION")
  return {
    ...state,
    stage: to,
    storedStatus: storedStatusForLoopStage(to),
    sentAt: to === "sent" ? at : state.sentAt,
    receivedAt: to === "received" ? at : state.receivedAt,
    arrivedAt: to === "arrived" ? at : state.arrivedAt,
    seenAt: to === "seen" ? at : state.seenAt,
  }
}

export function recordReferralFeedback(
  state: ReferralLoopState,
  input: { feedback: string; counterReferralId?: string | null },
): ReferralLoopState {
  if (!input.feedback.trim()) throw new Error("REFERRAL_FEEDBACK_REQUIRED")
  const next = state.stage === "seen" ? advanceReferralLoop(state, "feedback_returned") : state
  if (next.stage !== "feedback_returned") throw new Error("REFERRAL_LOOP_INVALID_TRANSITION")
  return {
    ...next,
    feedback: input.feedback.trim(),
    counterReferralId: input.counterReferralId ?? next.counterReferralId ?? null,
  }
}

export function referralLoopFromRow(row: {
  id: string
  status: FacilityReferral["status"]
  loop_stage?: string | null
  sent_at?: string | null
  received_at?: string | null
  arrived_at?: string | null
  seen_at?: string | null
  feedback?: string | null
  counter_referral_id?: string | null
}): ReferralLoopState {
  const stage = REFERRAL_LOOP_STAGES.includes(row.loop_stage as ReferralLoopStage)
    ? (row.loop_stage as ReferralLoopStage)
    : loopStageFromStoredStatus(row.status)
  return {
    referralId: row.id,
    storedStatus: row.status,
    stage,
    sentAt: row.sent_at ?? null,
    receivedAt: row.received_at ?? null,
    arrivedAt: row.arrived_at ?? null,
    seenAt: row.seen_at ?? null,
    feedback: row.feedback ?? null,
    counterReferralId: row.counter_referral_id ?? null,
  }
}

export function referralLoopToRow(state: ReferralLoopState): Record<string, unknown> {
  return {
    loop_stage: state.stage,
    sent_at: state.sentAt ?? null,
    received_at: state.receivedAt ?? null,
    arrived_at: state.arrivedAt ?? null,
    seen_at: state.seenAt ?? null,
    feedback: state.feedback ?? null,
    counter_referral_id: state.counterReferralId ?? null,
  }
}

export function renderReferralLetterSnapshot(input: {
  referral: FacilityReferral
  patientName: string
  synapseId: string
  ageSex?: string
  referringFacility: string
  receivingFacility: string
  referringClinician: string
  vitals?: string
  diagnoses?: string
  medications?: string
  allergies?: string
  investigations?: string
  transport?: string
}): string {
  return [
    `REFERRAL LETTER`,
    `From: ${input.referringFacility}`,
    `To: ${input.receivingFacility}`,
    `Clinician: ${input.referringClinician}`,
    `Date: ${input.referral.createdAt}`,
    `Patient: ${input.patientName} (${input.synapseId}) ${input.ageSex ?? ""}`.trim(),
    `Encounter: ${input.referral.encounterId}`,
    `Speciality: ${input.referral.speciality}`,
    `Urgency: ${input.referral.urgency}`,
    `Reason: ${input.referral.clinicalSummary}`,
    input.vitals ? `Vitals: ${input.vitals}` : null,
    input.diagnoses ? `Working diagnoses: ${input.diagnoses}` : null,
    input.investigations ? `Investigations: ${input.investigations}` : null,
    input.medications ? `Medications: ${input.medications}` : null,
    input.allergies ? `Allergies: ${input.allergies}` : null,
    input.transport ? `Transport: ${input.transport}` : null,
    `Consent obtained: ${input.referral.consentObtained ? "yes" : "no"}`,
    `QR: verify via secure facility reference ${input.referral.id} — do not encode PHI in a public QR.`,
  ].filter(Boolean).join("\n")
}

export function referralLetterVerificationPayload(referralId: string): { kind: "referral-reference"; id: string; phi: false } {
  return { kind: "referral-reference", id: referralId, phi: false }
}

export function buildReferralLetterDocument(input: {
  tenantId: string
  facilityId: string
  authorId: string
  patientName: string
  synapseId: string
  referringFacility: string
  receivingFacility: string
  referringClinician: string
  referral: FacilityReferral
}): ClinicalDocument {
  const renderedSnapshot = renderReferralLetterSnapshot({
    referral: input.referral,
    patientName: input.patientName,
    synapseId: input.synapseId,
    referringFacility: input.referringFacility,
    receivingFacility: input.receivingFacility,
    referringClinician: input.referringClinician,
  })
  return createClinicalDocument({
    tenantId: input.tenantId,
    facilityId: input.facilityId,
    patientId: input.referral.patientId,
    encounterId: input.referral.encounterId,
    authorId: input.authorId,
    documentType: "REFERRAL_LETTER",
    templateId: "referral.letter",
    templateVersion: "v1",
    structuredPayload: {
      referralId: input.referral.id,
      speciality: input.referral.speciality,
      urgency: input.referral.urgency,
      synapseId: input.synapseId,
      qrMode: "secure-reference",
    },
    renderedSnapshot,
  })
}
