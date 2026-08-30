/**
 * Interdepartment Task / WorkQueue abstraction.
 * Routes work between departments via explicit tasks rather than ad-hoc row discovery.
 */

import { ExchangeOutbox, type RecordDomainEventInput } from "./exchange"
import type { DomainEventType } from "@synapse/interop"

export const TASK_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ["STAT", "URGENT", "ROUTINE", "LOW"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_TYPES = [
  "lab_order",
  "lab_collection",
  "lab_verification",
  "imaging_order",
  "imaging_report",
  "prescription",
  "pharmacy_dispense",
  "admission",
  "transfer",
  "discharge",
  "referral",
  "billing",
  "insurance_claim",
  "nursing_observation",
  "theatre_procedure",
  "consultation",
  "triage",
  "registration",
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export type DepartmentTask = {
  id: string
  tenantId: string
  facilityId?: string | null
  hospitalId?: string | null
  patientId?: string | null
  personId?: string | null
  encounterId?: string | null
  requesterId?: string | null
  ownerDepartment: string
  ownerRole?: string | null
  taskType: TaskType
  priority: TaskPriority
  status: TaskStatus
  title: string
  description?: string | null
  sourceResource?: string | null
  sourceId?: string | null
  correlationId?: string | null
  causationId?: string | null
  idempotencyKey?: string | null
  dueAt?: string | null
  acceptedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  assignedTo?: string | null
  resultSummary?: string | null
  metadata?: Record<string, unknown>
  isSynthetic: boolean
  simulationRunId?: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTaskInput = {
  tenantId: string
  facilityId?: string
  hospitalId?: string
  patientId?: string
  personId?: string
  encounterId?: string
  requesterId?: string
  ownerDepartment: string
  ownerRole?: string
  taskType: TaskType
  priority?: TaskPriority
  title: string
  description?: string
  sourceResource?: string
  sourceId?: string
  correlationId?: string
  causationId?: string
  idempotencyKey?: string
  dueAt?: string
  assignedTo?: string
  metadata?: Record<string, unknown>
  isSynthetic?: boolean
  simulationRunId?: string
  /** When set, domain events use this aggregate id (e.g. lab_orders.id) instead of task.id */
  domainEventAggregateId?: string
  /** Skip task.created domain event (caller emits authoritative event separately) */
  suppressDomainEvent?: boolean
}

type TransitionResult =
  | { ok: true; task: DepartmentTask; event?: RecordDomainEventInput }
  | { ok: false; error: string }

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  REQUESTED: ["ACCEPTED", "CANCELLED", "FAILED"],
  ACCEPTED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED", "FAILED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED", "FAILED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED", "FAILED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
}

function taskEventType(taskType: TaskType, status: TaskStatus): DomainEventType | null {
  if (status !== "REQUESTED" && status !== "COMPLETED") return null
  const map: Partial<Record<TaskType, { created: DomainEventType; completed: DomainEventType }>> = {
    lab_order: { created: "LabOrderCreated", completed: "LabResultReleased" },
    prescription: { created: "PrescriptionCreated", completed: "MedicationDispensed" },
    imaging_order: { created: "ImagingOrderCreated", completed: "ImagingReportFinalized" },
    referral: { created: "ReferralCreated", completed: "ReferralCompleted" },
    billing: { created: "InvoiceCreated", completed: "PaymentRecorded" },
    insurance_claim: { created: "ClaimSubmitted", completed: "ClaimPaid" },
  }
  const entry = map[taskType]
  if (!entry) return null
  return status === "REQUESTED" ? entry.created : entry.completed
}

export class WorkQueue {
  readonly tasks: Map<string, DepartmentTask> = new Map()
  readonly outbox: ExchangeOutbox

  constructor(outbox = new ExchangeOutbox()) {
    this.outbox = outbox
  }

  private findByIdempotency(tenantId: string, key: string): DepartmentTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.tenantId === tenantId && task.idempotencyKey === key) return task
    }
    return undefined
  }

  create(input: CreateTaskInput, now = new Date()): TransitionResult {
    if (input.idempotencyKey) {
      const existing = this.findByIdempotency(input.tenantId, input.idempotencyKey)
      if (existing) return { ok: true, task: existing }
    }

    const id = crypto.randomUUID()
    const ts = now.toISOString()
    const task: DepartmentTask = {
      id,
      tenantId: input.tenantId,
      facilityId: input.facilityId ?? null,
      hospitalId: input.hospitalId ?? null,
      patientId: input.patientId ?? null,
      personId: input.personId ?? null,
      encounterId: input.encounterId ?? null,
      requesterId: input.requesterId ?? null,
      ownerDepartment: input.ownerDepartment,
      ownerRole: input.ownerRole ?? null,
      taskType: input.taskType,
      priority: input.priority ?? "ROUTINE",
      status: "REQUESTED",
      title: input.title,
      description: input.description ?? null,
      sourceResource: input.sourceResource ?? null,
      sourceId: input.sourceId ?? null,
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      dueAt: input.dueAt ?? null,
      assignedTo: input.assignedTo ?? null,
      metadata: input.metadata ?? {},
      isSynthetic: input.isSynthetic ?? false,
      simulationRunId: input.simulationRunId ?? null,
      createdAt: ts,
      updatedAt: ts,
    }
    this.tasks.set(id, task)

    const eventType = taskEventType(task.taskType, "REQUESTED")
    let event: RecordDomainEventInput | undefined
    if (eventType && !input.suppressDomainEvent) {
      event = {
        eventType,
        tenantId: task.tenantId,
        facilityId: task.facilityId ?? undefined,
        patientId: task.patientId ?? undefined,
        encounterId: task.encounterId ?? undefined,
        actorId: task.requesterId ?? undefined,
        source: "synapse-os",
        aggregateId: input.domainEventAggregateId ?? task.id,
        action: "task.created",
        correlationId: task.correlationId ?? task.id,
        causationId: task.causationId ?? undefined,
        payload: {
          task_id: task.id,
          task_type: task.taskType,
          owner_department: task.ownerDepartment,
          title: task.title,
          is_synthetic: task.isSynthetic,
        },
        isSynthetic: task.isSynthetic,
        simulationRunId: task.simulationRunId ?? null,
      }
      this.outbox.append(event)
    }

    return { ok: true, task, event }
  }

  transition(
    taskId: string,
    toStatus: TaskStatus,
    opts?: { assignedTo?: string; resultSummary?: string; actorId?: string },
    now = new Date(),
  ): TransitionResult {
    const task = this.tasks.get(taskId)
    if (!task) return { ok: false, error: "TASK_NOT_FOUND" }

    const allowed = VALID_TRANSITIONS[task.status]
    if (!allowed.includes(toStatus)) {
      return { ok: false, error: `INVALID_TRANSITION:${task.status}->${toStatus}` }
    }

    const ts = now.toISOString()
    task.status = toStatus
    task.updatedAt = ts
    if (toStatus === "ACCEPTED") task.acceptedAt = ts
    if (toStatus === "COMPLETED") task.completedAt = ts
    if (toStatus === "CANCELLED") task.cancelledAt = ts
    if (opts?.assignedTo) task.assignedTo = opts.assignedTo
    if (opts?.resultSummary) task.resultSummary = opts.resultSummary

    let event: RecordDomainEventInput | undefined
    if (toStatus === "COMPLETED") {
      const eventType = taskEventType(task.taskType, "COMPLETED")
      if (eventType) {
        event = {
          eventType,
          tenantId: task.tenantId,
          facilityId: task.facilityId ?? undefined,
          patientId: task.patientId ?? undefined,
          encounterId: task.encounterId ?? undefined,
          actorId: opts?.actorId ?? task.assignedTo ?? undefined,
          source: "synapse-os",
          aggregateId: task.id,
          action: "task.completed",
          correlationId: task.correlationId ?? task.id,
          causationId: task.id,
          payload: {
            task_id: task.id,
            task_type: task.taskType,
            result_summary: task.resultSummary,
            is_synthetic: task.isSynthetic,
          },
          isSynthetic: task.isSynthetic,
          simulationRunId: task.simulationRunId ?? null,
        }
        this.outbox.append(event)
      }
    }

    return { ok: true, task, event }
  }

  accept(taskId: string, assignedTo: string, now = new Date()) {
    return this.transition(taskId, "ACCEPTED", { assignedTo }, now)
  }

  start(taskId: string, actorId: string, now = new Date()) {
    const task = this.tasks.get(taskId)
    if (!task) return { ok: false as const, error: "TASK_NOT_FOUND" }
    if (task.status === "REQUESTED") {
      const accepted = this.accept(taskId, actorId, now)
      if (!accepted.ok) return accepted
    }
    return this.transition(taskId, "IN_PROGRESS", { assignedTo: actorId }, now)
  }

  complete(taskId: string, resultSummary: string, actorId: string, now = new Date()) {
    return this.transition(taskId, "COMPLETED", { resultSummary, actorId }, now)
  }

  cancel(taskId: string, reason: string, now = new Date()) {
    return this.transition(taskId, "CANCELLED", { resultSummary: reason }, now)
  }

  list(filter: {
    tenantId: string
    ownerDepartment?: string
    status?: TaskStatus | TaskStatus[]
    patientId?: string
    encounterId?: string
  }): DepartmentTask[] {
    const statuses = filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null

    return [...this.tasks.values()]
      .filter((t) => t.tenantId === filter.tenantId)
      .filter((t) => !filter.ownerDepartment || t.ownerDepartment === filter.ownerDepartment)
      .filter((t) => !statuses || statuses.includes(t.status))
      .filter((t) => !filter.patientId || t.patientId === filter.patientId)
      .filter((t) => !filter.encounterId || t.encounterId === filter.encounterId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  get(taskId: string): DepartmentTask | undefined {
    return this.tasks.get(taskId)
  }
}

/** Route a clinical order to the appropriate department queue. */
export function routeClinicalOrder(
  queue: WorkQueue,
  order: {
    orderType: "lab" | "imaging" | "prescription" | "admission" | "referral"
    tenantId: string
    hospitalId?: string
    patientId: string
    personId?: string
    encounterId: string
    requesterId: string
    correlationId: string
    title: string
    priority?: TaskPriority
    sourceResource: string
    sourceId: string
    isSynthetic?: boolean
    simulationRunId?: string
    suppressTaskDomainEvent?: boolean
  },
): TransitionResult {
  const deptMap: Record<string, { department: string; taskType: TaskType }> = {
    lab: { department: "laboratory", taskType: "lab_order" },
    imaging: { department: "radiology", taskType: "imaging_order" },
    prescription: { department: "pharmacy", taskType: "prescription" },
    admission: { department: "inpatient", taskType: "admission" },
    referral: { department: "referral", taskType: "referral" },
  }
  const route = deptMap[order.orderType]
  if (!route) return { ok: false, error: "UNKNOWN_ORDER_TYPE" }

  return queue.create({
    tenantId: order.tenantId,
    hospitalId: order.hospitalId,
    patientId: order.patientId,
    personId: order.personId,
    encounterId: order.encounterId,
    requesterId: order.requesterId,
    ownerDepartment: route.department,
    taskType: route.taskType,
    priority: order.priority ?? "ROUTINE",
    title: order.title,
    sourceResource: order.sourceResource,
    sourceId: order.sourceId,
    correlationId: order.correlationId,
    idempotencyKey: `${order.sourceResource}:${order.sourceId}:${route.taskType}`,
    domainEventAggregateId: order.sourceId,
    suppressDomainEvent: order.suppressTaskDomainEvent,
    isSynthetic: order.isSynthetic,
    simulationRunId: order.simulationRunId,
  })
}
