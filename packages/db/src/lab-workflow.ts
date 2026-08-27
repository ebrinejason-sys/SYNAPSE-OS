/**
 * Synapse Lab order → result state machine.
 * Reuses lab_orders / lab_specimens / lab_results concepts. Never silently
 * overwrites a verified result. AI is not a verifier.
 */

export const LAB_ORDER_STATUSES = [
  "ORDERED",
  "COLLECTION_PENDING",
  "COLLECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "REJECTED",
  "PROCESSING",
  "RESULT_ENTERED",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "RELEASED",
  "AMENDED",
  "CANCELLED",
] as const

export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number]

export const SPECIMEN_REJECTION_REASONS = [
  "hemolyzed",
  "clotted",
  "insufficient_volume",
  "unlabelled",
  "mislabeled",
  "wrong_container",
  "leaked",
  "too_old",
  "contaminated",
  "patient_mismatch",
  "other",
] as const

export type SpecimenRejectionReason = (typeof SPECIMEN_REJECTION_REASONS)[number]

export type AbnormalFlag = "N" | "H" | "L" | "HH" | "LL" | "A" | "AA" | "CRIT"

export type LabReferenceRange = {
  loincCode: string
  testName: string
  unit: string
  sex?: "M" | "F" | "I" | "U" | null
  ageMinYears?: number | null
  ageMaxYears?: number | null
  low: number
  high: number
  criticalLow?: number | null
  criticalHigh?: number | null
}

export type LabOrder = {
  id: string
  tenantId: string
  patientId: string
  personId?: string | null
  encounterId: string
  carePlanId?: string | null
  loincCode: string
  testName: string
  urgency: "STAT" | "URGENT" | "ROUTINE"
  status: LabOrderStatus
  orderedBy: string
  orderedAt: string
  accessionNumber?: string | null
  barcode?: string | null
  specimenId?: string | null
  rejectionReason?: SpecimenRejectionReason | null
  rejectionNote?: string | null
  isSynthetic: boolean
  simulationRunId?: string | null
  correlationId: string
}

export type LabResult = {
  id: string
  labOrderId: string
  tenantId: string
  patientId: string
  loincCode: string
  testName: string
  resultValue: string
  numericValue: number | null
  unit: string
  referenceRange: string
  flag: AbnormalFlag
  isCritical: boolean
  isAbnormal: boolean
  status: "preliminary" | "final" | "amended" | "cancelled"
  analyzer?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  releasedAt?: string | null
  version: number
  provenance: "LAB_VERIFIED" | "IMPORTED" | "SYSTEM_GENERATED"
  isSynthetic: boolean
}

export type LabAmendment = {
  id: string
  resultId: string
  previousValue: string
  previousStatus: string
  newValue: string
  reason: string
  amendedBy: string
  amendedAt: string
}

export type CriticalAcknowledgement = {
  id: string
  resultId: string
  labOrderId: string
  acknowledgedBy: string
  acknowledgedAt: string
  note?: string | null
}

const ALLOWED: Record<LabOrderStatus, LabOrderStatus[]> = {
  ORDERED: ["COLLECTION_PENDING", "CANCELLED"],
  COLLECTION_PENDING: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["IN_TRANSIT", "RECEIVED", "REJECTED", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED", "REJECTED", "CANCELLED"],
  RECEIVED: ["PROCESSING", "REJECTED", "CANCELLED"],
  REJECTED: [],
  PROCESSING: ["RESULT_ENTERED", "REJECTED", "CANCELLED"],
  RESULT_ENTERED: ["VERIFICATION_PENDING", "CANCELLED"],
  VERIFICATION_PENDING: ["VERIFIED", "CANCELLED"],
  VERIFIED: ["RELEASED", "AMENDED"],
  RELEASED: ["AMENDED"],
  AMENDED: ["RELEASED"],
  CANCELLED: [],
}

export const DEMO_REFERENCE_RANGES: LabReferenceRange[] = [
  {
    loincCode: "2524-7",
    testName: "Lactate",
    unit: "mmol/L",
    low: 0.5,
    high: 2.0,
    criticalHigh: 4.0,
  },
  {
    loincCode: "6690-2",
    testName: "WBC",
    unit: "10*9/L",
    low: 4.0,
    high: 11.0,
    criticalLow: 1.0,
    criticalHigh: 30.0,
  },
  {
    loincCode: "2345-7",
    testName: "Glucose",
    unit: "mmol/L",
    low: 3.9,
    high: 6.1,
    criticalLow: 2.2,
    criticalHigh: 30.0,
  },
  {
    loincCode: "2951-2",
    testName: "Sodium",
    unit: "mmol/L",
    low: 135,
    high: 145,
    criticalLow: 120,
    criticalHigh: 160,
  },
  {
    loincCode: "2823-3",
    testName: "Potassium",
    unit: "mmol/L",
    low: 3.5,
    high: 5.1,
    criticalLow: 2.5,
    criticalHigh: 6.5,
  },
  {
    loincCode: "58413-6",
    testName: "Malaria Pf antigen",
    unit: "arb",
    low: 0,
    high: 0,
  },
]

export function canTransitionLabStatus(from: LabOrderStatus, to: LabOrderStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function assertLabTransition(from: LabOrderStatus, to: LabOrderStatus): void {
  if (!canTransitionLabStatus(from, to)) {
    throw new Error(`LAB_ILLEGAL_TRANSITION:${from}->${to}`)
  }
}

export function nextLabStatuses(from: LabOrderStatus): LabOrderStatus[] {
  return [...ALLOWED[from]]
}

export function formatAccession(tenantCode: string, seq: number, date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${tenantCode}-${y}${m}${d}-${String(seq).padStart(5, "0")}`
}

export function barcodeFromAccession(accession: string): string {
  return accession.replace(/[^A-Z0-9]/gi, "").toUpperCase()
}

export function parseNumericResult(value: string): number | null {
  const match = value.trim().replace(",", ".").match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

export function interpretResult(params: {
  loincCode: string
  value: string
  sex?: "M" | "F" | "I" | "U" | null
  ageYears?: number | null
  ranges?: LabReferenceRange[]
}): {
  flag: AbnormalFlag
  isCritical: boolean
  isAbnormal: boolean
  range: LabReferenceRange | null
  referenceRange: string
} {
  const ranges = params.ranges ?? DEMO_REFERENCE_RANGES
  const range =
    ranges.find((item) => {
      if (item.loincCode !== params.loincCode) return false
      if (item.sex && params.sex && item.sex !== params.sex && params.sex !== "U") return false
      if (item.ageMinYears != null && params.ageYears != null && params.ageYears < item.ageMinYears) return false
      if (item.ageMaxYears != null && params.ageYears != null && params.ageYears > item.ageMaxYears) return false
      return true
    }) ?? null

  if (!range) {
    return { flag: "A", isCritical: false, isAbnormal: false, range: null, referenceRange: "not established" }
  }

  const numeric = parseNumericResult(params.value)
  if (numeric == null) {
    const positive = /positive|detected|reactive/i.test(params.value)
    return {
      flag: positive ? "A" : "N",
      isCritical: false,
      isAbnormal: positive,
      range,
      referenceRange: `${range.low}–${range.high} ${range.unit}`,
    }
  }

  let flag: AbnormalFlag = "N"
  if (range.criticalHigh != null && numeric >= range.criticalHigh) flag = "CRIT"
  else if (range.criticalLow != null && numeric <= range.criticalLow) flag = "CRIT"
  else if (numeric > range.high) flag = numeric > range.high * 1.5 ? "HH" : "H"
  else if (numeric < range.low) flag = numeric < range.low * 0.5 ? "LL" : "L"

  return {
    flag,
    isCritical: flag === "CRIT",
    isAbnormal: flag !== "N",
    range,
    referenceRange: `${range.low}–${range.high} ${range.unit}`,
  }
}

export function persistableLabOrderStatus(status: LabOrderStatus): string {
  switch (status) {
    case "ORDERED":
    case "COLLECTION_PENDING":
      return "ordered"
    case "COLLECTED":
    case "IN_TRANSIT":
      return "collected"
    case "RECEIVED":
    case "PROCESSING":
      return "processing"
    case "RESULT_ENTERED":
    case "VERIFICATION_PENDING":
      return "resulted"
    case "VERIFIED":
    case "RELEASED":
    case "AMENDED":
      return "verified"
    case "REJECTED":
    case "CANCELLED":
      return "cancelled"
  }
}

export class LabWorkflow {
  private orders: LabOrder[]
  private results: LabResult[]
  private amendments: LabAmendment[]
  private acknowledgements: CriticalAcknowledgement[]

  constructor(
    orders: LabOrder[] = [],
    results: LabResult[] = [],
    amendments: LabAmendment[] = [],
    acknowledgements: CriticalAcknowledgement[] = [],
  ) {
    this.orders = orders
    this.results = results
    this.amendments = amendments
    this.acknowledgements = acknowledgements
  }

  createOrder(order: LabOrder): LabOrder {
    this.orders.push(order)
    return order
  }

  getOrder(id: string): LabOrder {
    const order = this.orders.find((row) => row.id === id)
    if (!order) throw new Error("LAB_ORDER_NOT_FOUND")
    return order
  }

  transition(orderId: string, to: LabOrderStatus, patch?: Partial<LabOrder>): LabOrder {
    const order = this.getOrder(orderId)
    assertLabTransition(order.status, to)
    Object.assign(order, patch, { status: to })
    return order
  }

  collect(orderId: string, accessionNumber: string, barcode: string, specimenId: string): LabOrder {
    return this.transition(orderId, "COLLECTED", { accessionNumber, barcode, specimenId })
  }

  receive(orderId: string): LabOrder {
    const order = this.getOrder(orderId)
    if (order.status === "COLLECTED") this.transition(orderId, "IN_TRANSIT")
    const current = this.getOrder(orderId)
    if (current.status === "IN_TRANSIT") return this.transition(orderId, "RECEIVED")
    return this.transition(orderId, "RECEIVED")
  }

  reject(orderId: string, reason: SpecimenRejectionReason, note?: string): LabOrder {
    return this.transition(orderId, "REJECTED", { rejectionReason: reason, rejectionNote: note ?? null })
  }

  enterResult(params: {
    resultId: string
    orderId: string
    value: string
    analyzer?: string | null
    sex?: "M" | "F" | "I" | "U" | null
    ageYears?: number | null
  }): { order: LabOrder; result: LabResult } {
    const order = this.getOrder(params.orderId)
    if (order.status === "RECEIVED") this.transition(order.id, "PROCESSING")
    if (this.getOrder(order.id).status === "PROCESSING") this.transition(order.id, "RESULT_ENTERED")
    const interp = interpretResult({
      loincCode: order.loincCode,
      value: params.value,
      sex: params.sex,
      ageYears: params.ageYears,
    })
    const result: LabResult = {
      id: params.resultId,
      labOrderId: order.id,
      tenantId: order.tenantId,
      patientId: order.patientId,
      loincCode: order.loincCode,
      testName: order.testName,
      resultValue: params.value,
      numericValue: parseNumericResult(params.value),
      unit: interp.range?.unit ?? "",
      referenceRange: interp.referenceRange,
      flag: interp.flag,
      isCritical: interp.isCritical,
      isAbnormal: interp.isAbnormal,
      status: "preliminary",
      analyzer: params.analyzer ?? null,
      version: 1,
      provenance: "SYSTEM_GENERATED",
      isSynthetic: order.isSynthetic,
    }
    this.results.push(result)
    this.transition(order.id, "VERIFICATION_PENDING")
    return { order: this.getOrder(order.id), result }
  }

  verify(orderId: string, verifierId: string, at = new Date().toISOString()): LabResult {
    const order = this.getOrder(orderId)
    this.transition(order.id, "VERIFIED")
    const result = this.results.find((row) => row.labOrderId === orderId)
    if (!result) throw new Error("LAB_RESULT_NOT_FOUND")
    result.status = "final"
    result.verifiedBy = verifierId
    result.verifiedAt = at
    result.provenance = "LAB_VERIFIED"
    return result
  }

  release(orderId: string, at = new Date().toISOString()): LabResult {
    this.transition(orderId, "RELEASED")
    const result = this.results.find((row) => row.labOrderId === orderId)
    if (!result) throw new Error("LAB_RESULT_NOT_FOUND")
    result.releasedAt = at
    return result
  }

  amend(params: {
    amendmentId: string
    orderId: string
    newValue: string
    reason: string
    amendedBy: string
    sex?: "M" | "F" | "I" | "U" | null
    ageYears?: number | null
  }): { result: LabResult; amendment: LabAmendment } {
    const result = this.results.find((row) => row.labOrderId === params.orderId)
    if (!result) throw new Error("LAB_RESULT_NOT_FOUND")
    if (result.status !== "final" && result.status !== "amended") {
      throw new Error("LAB_AMEND_REQUIRES_VERIFIED")
    }
    const previousValue = result.resultValue
    const previousStatus = result.status
    const interp = interpretResult({
      loincCode: result.loincCode,
      value: params.newValue,
      sex: params.sex,
      ageYears: params.ageYears,
    })
    result.resultValue = params.newValue
    result.numericValue = parseNumericResult(params.newValue)
    result.flag = interp.flag
    result.isCritical = interp.isCritical
    result.isAbnormal = interp.isAbnormal
    result.referenceRange = interp.referenceRange
    result.status = "amended"
    result.version += 1
    this.transition(params.orderId, "AMENDED")
    const amendment: LabAmendment = {
      id: params.amendmentId,
      resultId: result.id,
      previousValue,
      previousStatus,
      newValue: params.newValue,
      reason: params.reason,
      amendedBy: params.amendedBy,
      amendedAt: new Date().toISOString(),
    }
    this.amendments.push(amendment)
    return { result, amendment }
  }

  acknowledgeCritical(params: {
    id: string
    orderId: string
    acknowledgedBy: string
    note?: string
  }): CriticalAcknowledgement {
    const result = this.results.find((row) => row.labOrderId === params.orderId)
    if (!result) throw new Error("LAB_RESULT_NOT_FOUND")
    if (!result.isCritical) throw new Error("LAB_NOT_CRITICAL")
    if (result.status !== "final" && result.status !== "amended") {
      throw new Error("LAB_ACK_REQUIRES_VERIFIED")
    }
    const ack: CriticalAcknowledgement = {
      id: params.id,
      resultId: result.id,
      labOrderId: params.orderId,
      acknowledgedBy: params.acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
      note: params.note ?? null,
    }
    this.acknowledgements.push(ack)
    return ack
  }

  snapshot() {
    return {
      orders: [...this.orders],
      results: [...this.results],
      amendments: [...this.amendments],
      acknowledgements: [...this.acknowledgements],
    }
  }
}
