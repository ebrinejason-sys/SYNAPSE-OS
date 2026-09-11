/**
 * Pure encounter close-gate evaluation for Hospital Pilot RC1.
 * HTTP routes gather state; this decides whether close is allowed.
 */

export type CloseBlocking =
  | "LAB"
  | "DOCTOR_REVIEW"
  | "PHARMACY"
  | "BILLING"
  | "DISPOSITION"
  | "TASK"
  | "ALREADY_CLOSED"
  | "NOT_FOUND"

export type EncounterCloseState = {
  encounterExists: boolean
  hospitalMatches: boolean
  status: string | null
  /** Doctor disposition required before close (RC1 closeout). */
  disposition?: string | null
  openLabOrderIds?: string[]
  unreviewedFinalResultIds?: string[]
  /** Active prescriptions that still require local pharmacy work. */
  blockingActivePrescriptionIds?: string[]
  invoice?: {
    id: string
    status: string
    totalAmount: number
    paidAmount: number
  } | null
  pendingTask?: { id: string; taskType: string } | null
}

export type EncounterCloseDecision =
  | { ok: true; alreadyClosed?: boolean }
  | { ok: false; blocking: CloseBlocking; sourceId?: string; error: string }

export function evaluateEncounterCloseGate(state: EncounterCloseState): EncounterCloseDecision {
  if (!state.encounterExists || !state.hospitalMatches) {
    return { ok: false, blocking: "NOT_FOUND", error: "Encounter not found" }
  }
  if (state.status === "completed") {
    return { ok: true, alreadyClosed: true }
  }
  const labs = state.openLabOrderIds ?? []
  if (labs.length) {
    return {
      ok: false,
      blocking: "LAB",
      sourceId: labs[0],
      error: "Encounter cannot close while required Lab work remains",
    }
  }
  const results = state.unreviewedFinalResultIds ?? []
  if (results.length) {
    return {
      ok: false,
      blocking: "DOCTOR_REVIEW",
      sourceId: results[0],
      error: "Encounter cannot close while a released result awaits Doctor review",
    }
  }
  const rx = state.blockingActivePrescriptionIds ?? []
  if (rx.length) {
    return {
      ok: false,
      blocking: "PHARMACY",
      sourceId: rx[0],
      error: "Encounter cannot close while local Pharmacy work remains",
    }
  }
  const invoice = state.invoice
  if (
    invoice &&
    invoice.status !== "paid" &&
    Number(invoice.totalAmount ?? 0) > Number(invoice.paidAmount ?? 0)
  ) {
    return {
      ok: false,
      blocking: "BILLING",
      sourceId: invoice.id,
      error: "Encounter cannot close while an invoice has an outstanding balance",
    }
  }
  if (!state.disposition || !String(state.disposition).trim()) {
    return {
      ok: false,
      blocking: "DISPOSITION",
      error: "Encounter cannot close until a doctor disposition is recorded",
    }
  }
  if (state.pendingTask) {
    return {
      ok: false,
      blocking: "TASK",
      sourceId: state.pendingTask.id,
      error: "Encounter cannot close while required work remains",
    }
  }
  return { ok: true }
}

/** Active local-pharmacy Rx rows that should block close. */
export function blockingLocalPharmacyPrescriptions(
  rows: Array<{ id: string; status: string; disposition?: string | null }>,
): string[] {
  return rows
    .filter((rx) => rx.status === "active")
    .filter((rx) => rx.disposition !== "EXTERNAL_PHARMACY" && rx.disposition !== "NO_MEDICATION")
    .map((rx) => rx.id)
}
