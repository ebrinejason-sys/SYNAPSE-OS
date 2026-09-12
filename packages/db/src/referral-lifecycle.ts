/**
 * Pure facility referral lifecycle for Hospital Pilot RC1.
 * Aligns with facility_referrals status check:
 * pending → accepted | rejected | cancelled → completed (from accepted).
 */

export const REFERRAL_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
] as const

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]

export const REFERRAL_URGENCIES = ["IMMEDIATE", "URGENT", "ROUTINE"] as const
export type ReferralUrgency = (typeof REFERRAL_URGENCIES)[number]

export type FacilityReferral = {
  id: string
  fromTenantId: string
  toTenantId: string
  patientId: string
  encounterId: string
  status: ReferralStatus
  speciality: string
  urgency: ReferralUrgency
  clinicalSummary: string
  consentObtained: boolean
  consentMethod?: "screen" | "sms_otp" | null
  createdBy: string
  createdAt: string
  acceptedBy?: string | null
  acceptedAt?: string | null
  rejectedReason?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  isSynthetic?: boolean
}

const ALLOWED: Record<ReferralStatus, ReferralStatus[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
}

export function canTransitionReferral(from: ReferralStatus, to: ReferralStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function createFacilityReferral(input: {
  id?: string
  fromTenantId: string
  toTenantId: string
  patientId: string
  encounterId: string
  speciality: string
  clinicalSummary: string
  createdBy: string
  urgency?: ReferralUrgency
  consentObtained?: boolean
  consentMethod?: "screen" | "sms_otp" | null
  isSynthetic?: boolean
}): FacilityReferral {
  if (input.fromTenantId === input.toTenantId) throw new Error("REFERRAL_SAME_FACILITY")
  if (!input.speciality.trim()) throw new Error("REFERRAL_SPECIALITY_REQUIRED")
  if (!input.clinicalSummary.trim()) throw new Error("REFERRAL_SUMMARY_REQUIRED")
  if (!input.patientId || !input.encounterId) throw new Error("REFERRAL_PATIENT_ENCOUNTER_REQUIRED")
  return {
    id: input.id ?? crypto.randomUUID(),
    fromTenantId: input.fromTenantId,
    toTenantId: input.toTenantId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    status: "pending",
    speciality: input.speciality.trim(),
    urgency: input.urgency ?? "ROUTINE",
    clinicalSummary: input.clinicalSummary.trim(),
    consentObtained: Boolean(input.consentObtained),
    consentMethod: input.consentMethod ?? null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    isSynthetic: input.isSynthetic ?? false,
  }
}

export function acceptReferral(
  referral: FacilityReferral,
  input: { acceptedBy: string; acceptedAt?: string },
): FacilityReferral {
  if (!canTransitionReferral(referral.status, "accepted")) throw new Error("REFERRAL_INVALID_TRANSITION")
  if (!input.acceptedBy.trim()) throw new Error("REFERRAL_ACCEPTOR_REQUIRED")
  return {
    ...referral,
    status: "accepted",
    acceptedBy: input.acceptedBy,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
  }
}

export function rejectReferral(
  referral: FacilityReferral,
  input: { reason: string },
): FacilityReferral {
  if (!canTransitionReferral(referral.status, "rejected")) throw new Error("REFERRAL_INVALID_TRANSITION")
  if (!input.reason.trim()) throw new Error("REFERRAL_REJECT_REASON_REQUIRED")
  return {
    ...referral,
    status: "rejected",
    rejectedReason: input.reason.trim(),
  }
}

export function completeReferral(referral: FacilityReferral, input?: { completedAt?: string }): FacilityReferral {
  if (!canTransitionReferral(referral.status, "completed")) throw new Error("REFERRAL_INVALID_TRANSITION")
  return {
    ...referral,
    status: "completed",
    completedAt: input?.completedAt ?? new Date().toISOString(),
  }
}

export function cancelReferral(referral: FacilityReferral, input?: { cancelledAt?: string }): FacilityReferral {
  if (!canTransitionReferral(referral.status, "cancelled")) throw new Error("REFERRAL_INVALID_TRANSITION")
  return {
    ...referral,
    status: "cancelled",
    cancelledAt: input?.cancelledAt ?? new Date().toISOString(),
  }
}

/** Domain golden: create → accept → complete with correlation on encounter. */
export function runReferralGoldenJourney(input?: {
  fromTenantId?: string
  toTenantId?: string
  patientId?: string
  encounterId?: string
  createdBy?: string
  acceptedBy?: string
}): {
  ok: boolean
  correlationId: string
  referral: FacilityReferral
  steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }>
} {
  const fromTenantId = input?.fromTenantId ?? crypto.randomUUID()
  const toTenantId = input?.toTenantId ?? crypto.randomUUID()
  const patientId = input?.patientId ?? crypto.randomUUID()
  const encounterId = input?.encounterId ?? crypto.randomUUID()
  const createdBy = input?.createdBy ?? crypto.randomUUID()
  const acceptedBy = input?.acceptedBy ?? crypto.randomUUID()
  const steps: Array<{ id: string; status: "PASS" | "FAIL"; detail?: string }> = []

  try {
    const created = createFacilityReferral({
      fromTenantId,
      toTenantId,
      patientId,
      encounterId,
      speciality: "Internal Medicine",
      clinicalSummary: "Persistent fever; needs secondary evaluation",
      createdBy,
      urgency: "URGENT",
      consentObtained: true,
      consentMethod: "screen",
      isSynthetic: true,
    })
    steps.push({ id: "create", status: "PASS" })

    const accepted = acceptReferral(created, { acceptedBy })
    steps.push({ id: "accept", status: "PASS" })

    const completed = completeReferral(accepted)
    steps.push({ id: "complete", status: "PASS" })

    // Negative: cannot accept after complete
    try {
      acceptReferral(completed, { acceptedBy })
      steps.push({ id: "reject_invalid_reaccept", status: "FAIL", detail: "expected REFERRAL_INVALID_TRANSITION" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      steps.push({
        id: "reject_invalid_reaccept",
        status: msg === "REFERRAL_INVALID_TRANSITION" ? "PASS" : "FAIL",
        detail: msg,
      })
    }

    const ok = steps.every((s) => s.status === "PASS") && completed.status === "completed"
    return { ok, correlationId: encounterId, referral: completed, steps }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push({ id: "journey", status: "FAIL", detail: msg })
    return {
      ok: false,
      correlationId: encounterId,
      referral: {
        id: "",
        fromTenantId,
        toTenantId,
        patientId,
        encounterId,
        status: "pending",
        speciality: "",
        urgency: "ROUTINE",
        clinicalSummary: "",
        consentObtained: false,
        createdBy,
        createdAt: new Date().toISOString(),
      },
      steps,
    }
  }
}
