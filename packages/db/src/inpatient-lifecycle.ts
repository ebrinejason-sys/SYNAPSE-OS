/**
 * Pure inpatient lifecycle for Hospital Pilot RC1 foundation.
 * Admit → transfer → discharge (no bed inventory DB required at domain layer).
 */

export const INPATIENT_STATUSES = ["ADMITTED", "TRANSFERRED", "DISCHARGED"] as const
export type InpatientStatus = (typeof INPATIENT_STATUSES)[number]

export type InpatientStay = {
  id: string
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId?: string | null
  status: InpatientStatus
  ward: string
  bedId: string
  admittedAt: string
  admittedBy: string
  transferredAt?: string | null
  transferredBy?: string | null
  dischargedAt?: string | null
  dischargedBy?: string | null
  dischargeDisposition?: string | null
  reason: string
  isSynthetic?: boolean
}

export type InpatientTransitionError =
  | "INVALID_STATUS"
  | "ALREADY_DISCHARGED"
  | "NOT_ADMITTED"
  | "SAME_WARD"
  | "MISSING_BED"
  | "MISSING_WARD"

const ALLOWED: Record<InpatientStatus, InpatientStatus[]> = {
  ADMITTED: ["TRANSFERRED", "DISCHARGED"],
  TRANSFERRED: ["TRANSFERRED", "DISCHARGED"],
  DISCHARGED: [],
}

export function canTransitionInpatient(from: InpatientStatus, to: InpatientStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function admitPatient(input: {
  id?: string
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId?: string | null
  ward: string
  bedId: string
  reason: string
  admittedBy: string
  admittedAt?: string
  isSynthetic?: boolean
}): InpatientStay {
  if (!input.ward.trim()) throw new Error("MISSING_WARD")
  if (!input.bedId.trim()) throw new Error("MISSING_BED")
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    encounterId: input.encounterId ?? null,
    status: "ADMITTED",
    ward: input.ward.trim(),
    bedId: input.bedId.trim(),
    admittedAt: input.admittedAt ?? new Date().toISOString(),
    admittedBy: input.admittedBy,
    reason: input.reason,
    isSynthetic: input.isSynthetic ?? false,
  }
}

export function transferPatient(
  stay: InpatientStay,
  input: { ward: string; bedId: string; transferredBy: string; transferredAt?: string },
): InpatientStay {
  if (stay.status === "DISCHARGED") throw new Error("ALREADY_DISCHARGED")
  if (!canTransitionInpatient(stay.status, "TRANSFERRED")) throw new Error("INVALID_STATUS")
  if (!input.ward.trim()) throw new Error("MISSING_WARD")
  if (!input.bedId.trim()) throw new Error("MISSING_BED")
  if (input.ward.trim() === stay.ward && input.bedId.trim() === stay.bedId) {
    throw new Error("SAME_WARD")
  }
  return {
    ...stay,
    status: "TRANSFERRED",
    ward: input.ward.trim(),
    bedId: input.bedId.trim(),
    transferredAt: input.transferredAt ?? new Date().toISOString(),
    transferredBy: input.transferredBy,
  }
}

export function dischargePatient(
  stay: InpatientStay,
  input: {
    dischargedBy: string
    dischargeDisposition: string
    dischargedAt?: string
  },
): InpatientStay {
  if (stay.status === "DISCHARGED") throw new Error("ALREADY_DISCHARGED")
  if (!canTransitionInpatient(stay.status, "DISCHARGED")) throw new Error("INVALID_STATUS")
  return {
    ...stay,
    status: "DISCHARGED",
    dischargedAt: input.dischargedAt ?? new Date().toISOString(),
    dischargedBy: input.dischargedBy,
    dischargeDisposition: input.dischargeDisposition,
  }
}
