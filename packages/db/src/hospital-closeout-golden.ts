/**
 * Hospital Pilot RC1 closeout golden journey (domain).
 * Proves billing balance → payment → disposition → close gate coherence.
 */

import {
  evaluateEncounterCloseGate,
  type EncounterCloseDecision,
  type EncounterCloseState,
} from "./encounter-close-gate"

export type CloseoutGoldenStep =
  | "INVOICE_OUTSTANDING"
  | "PAYMENT_APPLIED"
  | "DISPOSITION_RECORDED"
  | "CLOSE_ALLOWED"

export type CloseoutGoldenResult = {
  ok: boolean
  correlationId: string
  steps: Array<{ step: CloseoutGoldenStep; decision: EncounterCloseDecision }>
  final: EncounterCloseDecision
}

function baseState(overrides: Partial<EncounterCloseState> = {}): EncounterCloseState {
  return {
    encounterExists: true,
    hospitalMatches: true,
    status: "in_progress",
    disposition: null,
    openLabOrderIds: [],
    unreviewedFinalResultIds: [],
    blockingActivePrescriptionIds: [],
    invoice: { id: "inv-closeout", status: "issued", totalAmount: 25000, paidAmount: 0 },
    pendingTask: null,
    ...overrides,
  }
}

/**
 * Pure state-machine walk of the RC1 closeout path.
 * No DB — HTTP/live layers remain separate proofs.
 */
export function runHospitalCloseoutGoldenJourney(input?: {
  correlationId?: string
  requireLocalPharmacyClear?: boolean
}): CloseoutGoldenResult {
  const correlationId = input?.correlationId ?? `closeout-${Date.now()}`
  const steps: CloseoutGoldenResult["steps"] = []

  // 1) Outstanding invoice blocks close
  const outstanding = evaluateEncounterCloseGate(
    baseState({
      blockingActivePrescriptionIds: input?.requireLocalPharmacyClear ? [] : [],
    }),
  )
  steps.push({ step: "INVOICE_OUTSTANDING", decision: outstanding })

  // 2) Payment applied — still blocked on missing disposition
  const paid = evaluateEncounterCloseGate(
    baseState({
      invoice: { id: "inv-closeout", status: "paid", totalAmount: 25000, paidAmount: 25000 },
      disposition: null,
    }),
  )
  steps.push({ step: "PAYMENT_APPLIED", decision: paid })

  // 3) Disposition recorded — close should clear
  const disposed = evaluateEncounterCloseGate(
    baseState({
      invoice: { id: "inv-closeout", status: "paid", totalAmount: 25000, paidAmount: 25000 },
      disposition: "CLINICAL_COMPLETE",
    }),
  )
  steps.push({ step: "DISPOSITION_RECORDED", decision: disposed })

  const closeAllowed: EncounterCloseDecision = disposed.ok
    ? { ok: true }
    : disposed
  steps.push({ step: "CLOSE_ALLOWED", decision: closeAllowed })

  const ok =
    outstanding.ok === false &&
    (outstanding as { blocking?: string }).blocking === "BILLING" &&
    paid.ok === false &&
    (paid as { blocking?: string }).blocking === "DISPOSITION" &&
    disposed.ok === true

  return { ok, correlationId, steps, final: closeAllowed }
}
