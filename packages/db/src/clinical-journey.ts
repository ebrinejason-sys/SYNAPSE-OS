/**
 * Clinical journey helpers — correlate encounters, tasks, and domain events.
 * Production APIs call these after durable writes (encounters, orders, etc.).
 */

import { ExchangeOutbox } from "./exchange.ts"
import { LabWorkflow, type LabOrder } from "./lab-workflow.ts"
import { createPrescription, type ClinicalPrescription } from "./prescription-bridge.ts"
import { WorkQueue, routeClinicalOrder, type DepartmentTask } from "./work-queue.ts"

export type EncounterOpenedInput = {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  requesterId: string
  chiefComplaint: string
  /** When false (default), marks production clinical traffic — not simulation. */
  isSynthetic?: boolean
  simulationRunId?: string | null
  queue?: WorkQueue
}

export type EncounterOpenedResult = {
  queue: WorkQueue
  correlationId: string
  triageTask: DepartmentTask
  eventsEmitted: number
}

/** Begin a correlated OPD encounter: EncounterCreated event + triage department task. */
export function recordEncounterOpened(input: EncounterOpenedInput): EncounterOpenedResult {
  const queue = input.queue ?? new WorkQueue()
  const correlationId = input.encounterId
  const isSynthetic = input.isSynthetic ?? false

  queue.outbox.append({
    eventType: "EncounterCreated",
    tenantId: input.tenantId,
    facilityId: input.hospitalId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    actorId: input.requesterId,
    source: "synapse-os",
    aggregateId: input.encounterId,
    action: "encounter.created",
    correlationId,
    payload: {
      encounter_id: input.encounterId,
      patient_id: input.patientId,
      chief_complaint: input.chiefComplaint,
      is_synthetic: isSynthetic,
    },
    isSynthetic,
    simulationRunId: input.simulationRunId ?? null,
  })

  const triage = queue.create({
    tenantId: input.tenantId,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    requesterId: input.requesterId,
    ownerDepartment: "opd",
    ownerRole: "nurse",
    taskType: "triage",
    priority: "ROUTINE",
    title: `Triage: ${input.chiefComplaint}`,
    description: "Awaiting nursing triage and vitals review",
    sourceResource: "encounters",
    sourceId: input.encounterId,
    correlationId,
    idempotencyKey: `encounters:${input.encounterId}:triage`,
    isSynthetic,
    simulationRunId: input.simulationRunId ?? undefined,
  })

  if (!triage.ok) {
    throw new Error(triage.error)
  }

  return {
    queue,
    correlationId,
    triageTask: triage.task,
    eventsEmitted: queue.outbox.list({ correlationId }).length,
  }
}

/** Snapshot tasks/events for an encounter within a tenant work queue. */
export function getEncounterJourneySnapshot(queue: WorkQueue, tenantId: string, encounterId: string) {
  const correlationId = encounterId
  return {
    correlationId,
    tasks: queue.list({ tenantId, encounterId }),
    events: queue.outbox.list({ correlationId, tenantId }),
  }
}

export function createProductionWorkQueue(): WorkQueue {
  return new WorkQueue(new ExchangeOutbox())
}

export type LabOrderPlacedInput = {
  tenantId: string
  hospitalId: string
  patientId: string
  personId?: string | null
  encounterId: string
  carePlanId?: string | null
  requesterId: string
  loincCode: string
  testName: string
  urgency?: LabOrder["urgency"]
  correlationId?: string
  orderId?: string
  isSynthetic?: boolean
  simulationRunId?: string | null
  queue?: WorkQueue
  lab?: LabWorkflow
}

export type LabOrderPlacedResult = {
  queue: WorkQueue
  lab: LabWorkflow
  order: LabOrder
  labTask: DepartmentTask
  correlationId: string
  eventsEmitted: number
}

/** Place a lab order: LabOrderCreated (synapse-lab) + laboratory department task. */
export function recordLabOrderPlaced(input: LabOrderPlacedInput): LabOrderPlacedResult {
  const queue = input.queue ?? new WorkQueue()
  const lab = input.lab ?? new LabWorkflow()
  const correlationId = input.correlationId ?? input.encounterId
  const orderId = input.orderId ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const isSynthetic = input.isSynthetic ?? false
  const urgency = input.urgency ?? "ROUTINE"

  const order: LabOrder = {
    id: orderId,
    tenantId: input.tenantId,
    patientId: input.patientId,
    personId: input.personId ?? null,
    encounterId: input.encounterId,
    carePlanId: input.carePlanId ?? null,
    loincCode: input.loincCode,
    testName: input.testName,
    urgency,
    status: "ORDERED",
    orderedBy: input.requesterId,
    orderedAt: now,
    isSynthetic,
    simulationRunId: input.simulationRunId ?? null,
    correlationId,
  }

  lab.createOrder(order)

  queue.outbox.append({
    eventType: "LabOrderCreated",
    tenantId: input.tenantId,
    facilityId: input.hospitalId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    actorId: input.requesterId,
    source: "synapse-lab",
    aggregateId: order.id,
    action: "create",
    correlationId,
    payload: {
      order_id: order.id,
      loinc_code: order.loincCode,
      test_name: order.testName,
      urgency: order.urgency,
      is_synthetic: isSynthetic,
    },
    isSynthetic,
    simulationRunId: input.simulationRunId ?? null,
  })

  const routed = routeClinicalOrder(queue, {
    orderType: "lab",
    tenantId: input.tenantId,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    personId: input.personId ?? undefined,
    encounterId: input.encounterId,
    requesterId: input.requesterId,
    correlationId,
    title: `Lab: ${input.testName}`,
    priority: urgency,
    sourceResource: "lab_orders",
    sourceId: order.id,
    isSynthetic,
    simulationRunId: input.simulationRunId ?? undefined,
    suppressTaskDomainEvent: true,
  })

  if (!routed.ok) {
    throw new Error(routed.error)
  }

  return {
    queue,
    lab,
    order,
    labTask: routed.task,
    correlationId,
    eventsEmitted: queue.outbox.list({ correlationId }).length,
  }
}

export type PrescriptionPlacedInput = {
  tenantId: string
  hospitalId: string
  patientId: string
  personId?: string | null
  encounterId: string
  carePlanId?: string | null
  requesterId: string
  medicationDisplay: string
  dose: string
  quantity: number
  unit?: string
  pharmacyTenantId?: string | null
  correlationId?: string
  prescriptionId?: string
  isSynthetic?: boolean
  simulationRunId?: string | null
  queue?: WorkQueue
}

export type PrescriptionPlacedResult = {
  queue: WorkQueue
  prescription: ClinicalPrescription
  pharmacyTask: DepartmentTask
  correlationId: string
  eventsEmitted: number
}

/** Place a prescription: PrescriptionCreated + pharmacy department task. */
export function recordPrescriptionPlaced(input: PrescriptionPlacedInput): PrescriptionPlacedResult {
  const queue = input.queue ?? new WorkQueue()
  const correlationId = input.correlationId ?? input.encounterId
  const prescriptionId = input.prescriptionId ?? crypto.randomUUID()
  const isSynthetic = input.isSynthetic ?? false

  const prescription = createPrescription({
    id: prescriptionId,
    tenantId: input.tenantId,
    pharmacyTenantId: input.pharmacyTenantId ?? null,
    patientId: input.patientId,
    personId: input.personId ?? null,
    encounterId: input.encounterId,
    carePlanId: input.carePlanId ?? null,
    medicationDisplay: input.medicationDisplay,
    dose: input.dose,
    quantity: input.quantity,
    unit: input.unit ?? "unit",
    prescriberId: input.requesterId,
    status: "active",
    isSynthetic,
    simulationRunId: input.simulationRunId ?? null,
    correlationId,
  })

  queue.outbox.append({
    eventType: "PrescriptionCreated",
    tenantId: input.tenantId,
    facilityId: input.hospitalId,
    patientId: input.patientId,
    encounterId: input.encounterId,
    actorId: input.requesterId,
    source: "synapse-os",
    aggregateId: prescription.id,
    action: "create",
    correlationId,
    payload: {
      prescription_id: prescription.id,
      medication_display: prescription.medicationDisplay,
      dose: prescription.dose,
      quantity: prescription.quantity,
      is_synthetic: isSynthetic,
    },
    isSynthetic,
    simulationRunId: input.simulationRunId ?? null,
  })

  const routed = routeClinicalOrder(queue, {
    orderType: "prescription",
    tenantId: input.tenantId,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    personId: input.personId ?? undefined,
    encounterId: input.encounterId,
    requesterId: input.requesterId,
    correlationId,
    title: `Rx: ${input.medicationDisplay}`,
    priority: "ROUTINE",
    sourceResource: "clinical_prescriptions",
    sourceId: prescription.id,
    isSynthetic,
    simulationRunId: input.simulationRunId ?? undefined,
    suppressTaskDomainEvent: true,
  })

  if (!routed.ok) {
    throw new Error(routed.error)
  }

  return {
    queue,
    prescription,
    pharmacyTask: routed.task,
    correlationId,
    eventsEmitted: queue.outbox.list({ correlationId }).length,
  }
}
