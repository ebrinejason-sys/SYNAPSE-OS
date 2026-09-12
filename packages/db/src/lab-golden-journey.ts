/**
 * Lab Pilot RC1 golden journey (domain) — beside existing LabWorkflow / lab-report /
 * hospital golden lab branch. Proves specimen + TAT, reject→replacement recollect,
 * amend + printable report, and lock/AI-verify safety. Never invents a parallel stack.
 */

import { buildLabReportArtifact, type LabReportArtifact } from "./lab-report"
import {
  LabWorkflow,
  MALARIA_PF_ANTIGEN_LOINC,
  MALARIA_PF_ANTIGEN_TEST_NAME,
  barcodeFromAccession,
  formatAccession,
  type LabAmendment,
  type LabOrder,
  type LabResult,
} from "./lab-workflow"

export type LabGoldenStepId =
  | "order_placed"
  | "specimen_collected"
  | "specimen_received"
  | "specimen_rejected"
  | "recollect_replacement_order"
  | "result_entered"
  | "result_verified"
  | "result_released"
  | "tat_measured"
  | "final_report"
  | "result_locked_refuses_overwrite"
  | "ai_cannot_verify"
  | "result_amended"
  | "amended_report"
  | "journey"

export type LabGoldenStep = {
  id: LabGoldenStepId
  status: "PASS" | "FAIL"
  detail?: string
  data?: Record<string, unknown>
}

export type LabTatMs = {
  orderToReleaseMs: number
  collectToReleaseMs: number | null
  receiveToReleaseMs: number | null
}

export type LabGoldenJourneyResult = {
  ok: boolean
  correlationId: string
  steps: LabGoldenStep[]
  rejectedOrder: LabOrder | null
  releasedOrder: LabOrder | null
  releasedResult: LabResult | null
  amendment: LabAmendment | null
  finalReport: LabReportArtifact | null
  amendedReport: LabReportArtifact | null
  tat: LabTatMs | null
}

export function measureLabTatMs(input: {
  orderedAt: string
  collectedAt?: string | null
  receivedAt?: string | null
  releasedAt: string
}): LabTatMs {
  const ordered = Date.parse(input.orderedAt)
  const released = Date.parse(input.releasedAt)
  if (!Number.isFinite(ordered) || !Number.isFinite(released) || released < ordered) {
    throw new Error("LAB_TAT_INVALID_TIMESTAMPS")
  }
  const collect = input.collectedAt ? Date.parse(input.collectedAt) : NaN
  const receive = input.receivedAt ? Date.parse(input.receivedAt) : NaN
  return {
    orderToReleaseMs: released - ordered,
    collectToReleaseMs: Number.isFinite(collect) ? released - collect : null,
    receiveToReleaseMs: Number.isFinite(receive) ? released - receive : null,
  }
}

function step(
  id: LabGoldenStepId,
  status: "PASS" | "FAIL",
  detail?: string,
  data?: Record<string, unknown>,
): LabGoldenStep {
  return { id, status, detail, data }
}

function placeOrder(
  lab: LabWorkflow,
  input: {
    id: string
    tenantId: string
    patientId: string
    encounterId: string
    orderedBy: string
    orderedAt: string
    correlationId: string
  },
): LabOrder {
  return lab.createOrder({
    id: input.id,
    tenantId: input.tenantId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    loincCode: MALARIA_PF_ANTIGEN_LOINC,
    testName: MALARIA_PF_ANTIGEN_TEST_NAME,
    urgency: "URGENT",
    status: "ORDERED",
    orderedBy: input.orderedBy,
    orderedAt: input.orderedAt,
    isSynthetic: true,
    correlationId: input.correlationId,
  })
}

/**
 * Domain Lab golden: reject path + successful path with TAT, amend, printable reports.
 * Recollection after reject is modeled as a replacement order (REJECTED is terminal in LabWorkflow).
 */
export function runLabGoldenJourney(input?: {
  tenantId?: string
  patientId?: string
  encounterId?: string
  orderedBy?: string
  labTechId?: string
  scientistId?: string
  correlationId?: string
  now?: Date
}): LabGoldenJourneyResult {
  const now = input?.now ?? new Date("2026-09-12T10:00:00.000Z")
  const correlationId = input?.correlationId ?? crypto.randomUUID()
  const tenantId = input?.tenantId ?? crypto.randomUUID()
  const patientId = input?.patientId ?? crypto.randomUUID()
  const encounterId = input?.encounterId ?? crypto.randomUUID()
  const orderedBy = input?.orderedBy ?? crypto.randomUUID()
  const labTechId = input?.labTechId ?? crypto.randomUUID()
  const scientistId = input?.scientistId ?? "lab-scientist-1"
  const steps: LabGoldenStep[] = []
  const lab = new LabWorkflow()

  let rejectedOrder: LabOrder | null = null
  let releasedOrder: LabOrder | null = null
  let releasedResult: LabResult | null = null
  let amendment: LabAmendment | null = null
  let finalReport: LabReportArtifact | null = null
  let amendedReport: LabReportArtifact | null = null
  let tat: LabTatMs | null = null

  try {
    // --- Reject path (hemolyzed) ---
    const rejectOrderId = crypto.randomUUID()
    const orderedAtReject = now.toISOString()
    placeOrder(lab, {
      id: rejectOrderId,
      tenantId,
      patientId,
      encounterId,
      orderedBy,
      orderedAt: orderedAtReject,
      correlationId,
    })
    steps.push(step("order_placed", "PASS", undefined, { orderId: rejectOrderId, path: "reject" }))

    const rejectAccession = formatAccession("LAB", 1, now)
    lab.collect(rejectOrderId, rejectAccession, barcodeFromAccession(rejectAccession), crypto.randomUUID())
    steps.push(step("specimen_collected", "PASS", undefined, { orderId: rejectOrderId, accession: rejectAccession }))

    lab.receive(rejectOrderId)
    steps.push(step("specimen_received", "PASS", undefined, { orderId: rejectOrderId }))

    rejectedOrder = lab.reject(rejectOrderId, "hemolyzed", "Gross hemolysis on arrival")
    if (rejectedOrder.status !== "REJECTED" || rejectedOrder.rejectionReason !== "hemolyzed") {
      steps.push(
        step("specimen_rejected", "FAIL", "expected REJECTED/hemolyzed", {
          status: rejectedOrder.status,
          reason: rejectedOrder.rejectionReason,
        }),
      )
    } else {
      steps.push(
        step("specimen_rejected", "PASS", undefined, {
          reason: rejectedOrder.rejectionReason,
          note: rejectedOrder.rejectionNote,
        }),
      )
    }

    // --- Replacement recollect (new order; REJECTED is terminal) ---
    const successOrderId = crypto.randomUUID()
    const orderedAt = new Date(now.getTime() + 15 * 60_000).toISOString()
    const collectedAt = new Date(now.getTime() + 25 * 60_000).toISOString()
    const receivedAt = new Date(now.getTime() + 35 * 60_000).toISOString()
    const releasedAt = new Date(now.getTime() + 90 * 60_000).toISOString()

    placeOrder(lab, {
      id: successOrderId,
      tenantId,
      patientId,
      encounterId,
      orderedBy,
      orderedAt,
      correlationId,
    })
    steps.push(
      step("recollect_replacement_order", "PASS", undefined, {
        replacementOrderId: successOrderId,
        replacesRejectedOrderId: rejectOrderId,
      }),
    )

    const accession = formatAccession("LAB", 2, new Date(orderedAt))
    const barcode = barcodeFromAccession(accession)
    const specimenId = crypto.randomUUID()
    lab.collect(successOrderId, accession, barcode, specimenId)
    lab.receive(successOrderId)

    const entered = lab.enterResult({
      resultId: crypto.randomUUID(),
      orderId: successOrderId,
      value: "Negative",
      analyzer: "synthetic-manual",
    })
    steps.push(
      step("result_entered", "PASS", undefined, {
        resultId: entered.result.id,
        value: entered.result.resultValue,
        status: lab.getOrder(successOrderId).status,
      }),
    )

    // Safety: locked preliminary path refuses silent overwrite after enter
    try {
      lab.enterResult({
        resultId: crypto.randomUUID(),
        orderId: successOrderId,
        value: "Positive",
      })
      steps.push(step("result_locked_refuses_overwrite", "FAIL", "expected LAB_RESULT_LOCKED"))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      steps.push(
        step(
          "result_locked_refuses_overwrite",
          msg.includes("LAB_RESULT_LOCKED") ? "PASS" : "FAIL",
          msg,
        ),
      )
    }

    // Safety: AI cannot verify
    try {
      lab.verify(successOrderId, "ai_copilot")
      steps.push(step("ai_cannot_verify", "FAIL", "expected LAB_AI_CANNOT_VERIFY"))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      steps.push(
        step("ai_cannot_verify", msg.includes("LAB_AI_CANNOT_VERIFY") ? "PASS" : "FAIL", msg),
      )
    }

    const verified = lab.verify(successOrderId, scientistId, releasedAt)
    steps.push(
      step("result_verified", "PASS", undefined, {
        verifiedBy: verified.verifiedBy,
        status: lab.getOrder(successOrderId).status,
        actor: labTechId,
      }),
    )

    releasedResult = lab.release(successOrderId, releasedAt)
    releasedOrder = lab.getOrder(successOrderId)
    if (releasedOrder.status !== "RELEASED" || !releasedResult.releasedAt) {
      steps.push(step("result_released", "FAIL", "expected RELEASED with releasedAt"))
    } else {
      steps.push(
        step("result_released", "PASS", undefined, {
          resultId: releasedResult.id,
          value: releasedResult.resultValue,
        }),
      )
    }

    tat = measureLabTatMs({
      orderedAt,
      collectedAt,
      receivedAt,
      releasedAt,
    })
    if (tat.orderToReleaseMs !== 75 * 60_000) {
      steps.push(
        step("tat_measured", "FAIL", `expected 75min order→release, got ${tat.orderToReleaseMs}ms`, {
          ...tat,
        }),
      )
    } else {
      steps.push(
        step("tat_measured", "PASS", undefined, {
          orderToReleaseMs: tat.orderToReleaseMs,
          collectToReleaseMs: tat.collectToReleaseMs,
          receiveToReleaseMs: tat.receiveToReleaseMs,
          targetHintMinutes: 75,
        }),
      )
    }

    finalReport = buildLabReportArtifact({
      id: crypto.randomUUID(),
      tenantId,
      patientId,
      encounterId,
      orderId: successOrderId,
      clinicalResultId: releasedResult!.id,
      accession,
      testName: MALARIA_PF_ANTIGEN_TEST_NAME,
      loincCode: MALARIA_PF_ANTIGEN_LOINC,
      specimenType: "Whole blood",
      collectedAt,
      receivedAt,
      reportedAt: releasedAt,
      resultValue: releasedResult!.resultValue,
      unit: releasedResult!.unit,
      referenceRange: releasedResult!.referenceRange,
      abnormalFlag: releasedResult!.flag,
      isCritical: releasedResult!.isCritical,
      verifiedBy: scientistId,
      version: releasedResult!.version,
      status: "FINAL",
    })
    if (!finalReport.htmlSnapshot.includes("Laboratory Report") || !finalReport.contentHash) {
      steps.push(step("final_report", "FAIL", "missing printable HTML or contentHash"))
    } else {
      steps.push(
        step("final_report", "PASS", undefined, {
          reportId: finalReport.id,
          contentHash: finalReport.contentHash,
          templateVersion: finalReport.templateVersion,
          status: finalReport.status,
        }),
      )
    }

    const amended = lab.amend({
      amendmentId: crypto.randomUUID(),
      orderId: successOrderId,
      newValue: "Positive",
      reason: "Clerical correction after senior review",
      amendedBy: scientistId,
    })
    amendment = amended.amendment
    if (
      amended.result.status !== "amended" ||
      amended.result.version !== 2 ||
      amendment.previousValue !== "Negative" ||
      lab.getOrder(successOrderId).status !== "AMENDED"
    ) {
      steps.push(
        step("result_amended", "FAIL", "expected amended v2 retaining previous Negative", {
          status: amended.result.status,
          version: amended.result.version,
          previous: amendment.previousValue,
          orderStatus: lab.getOrder(successOrderId).status,
        }),
      )
    } else {
      steps.push(
        step("result_amended", "PASS", undefined, {
          previousValue: amendment.previousValue,
          newValue: amendment.newValue,
          version: amended.result.version,
          reason: amendment.reason,
        }),
      )
    }

    amendedReport = buildLabReportArtifact({
      id: crypto.randomUUID(),
      tenantId,
      patientId,
      encounterId,
      orderId: successOrderId,
      clinicalResultId: amended.result.id,
      accession,
      testName: MALARIA_PF_ANTIGEN_TEST_NAME,
      loincCode: MALARIA_PF_ANTIGEN_LOINC,
      specimenType: "Whole blood",
      collectedAt,
      receivedAt,
      reportedAt: new Date(now.getTime() + 100 * 60_000).toISOString(),
      resultValue: amended.result.resultValue,
      unit: amended.result.unit,
      referenceRange: amended.result.referenceRange,
      abnormalFlag: amended.result.flag,
      isCritical: amended.result.isCritical,
      verifiedBy: scientistId,
      version: amended.result.version,
      status: "AMENDED",
      supersedesReportId: finalReport.id,
      amendmentReason: amendment.reason,
    })
    if (
      amendedReport.status !== "AMENDED" ||
      amendedReport.version !== 2 ||
      amendedReport.contentHash === finalReport.contentHash ||
      !amendedReport.htmlSnapshot.includes("Positive")
    ) {
      steps.push(step("amended_report", "FAIL", "amended printable report did not diverge correctly"))
    } else {
      steps.push(
        step("amended_report", "PASS", undefined, {
          reportId: amendedReport.id,
          contentHash: amendedReport.contentHash,
          supersedesReportId: amendedReport.supersedesReportId,
          version: amendedReport.version,
        }),
      )
    }

    const ok = steps.every((s) => s.status === "PASS")
    return {
      ok,
      correlationId,
      steps,
      rejectedOrder,
      releasedOrder,
      releasedResult: amended.result,
      amendment,
      finalReport,
      amendedReport,
      tat,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    steps.push(step("journey", "FAIL", msg))
    return {
      ok: false,
      correlationId,
      steps,
      rejectedOrder,
      releasedOrder,
      releasedResult,
      amendment,
      finalReport,
      amendedReport,
      tat,
    }
  }
}
