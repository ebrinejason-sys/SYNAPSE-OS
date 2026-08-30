/**
 * Clinical journey helpers — correlate encounters, tasks, and domain events.
 * Production APIs call these after durable writes (encounters, orders, etc.).
 */

import { ExchangeOutbox } from "./exchange.ts"
import { WorkQueue, type DepartmentTask } from "./work-queue.ts"

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
